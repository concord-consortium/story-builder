# Story Builder Plugin Architecture 

## Overview

Story Builder allows a CODAP user to create "moments." Each moment holds the complete state for the CODAP document (minus the state of the plugin itself) that will come about when the user chooses that moment. Since it is a plugin, all transactions with CODAP are asynchronous, introducing subtleties in communication, chiefly that when CODAP requests the *plugin* state, nothing should be returned if the plugin is waiting for a notification containing *CODAP* state.

In order to limit file size, the plugin does not store a complete copy of data contexts in each moment. Instead, it stores a *master* for each data context it encounters and a diff from the master in each moment that references that master.

Story Builder manages a CODAP text component, synchronizing moment titles shown in the plugin with the title of the text component. The text the user types in this text component is stored with the moment so that it can be displayed when that moment is chosen.

A lot of callbacks are passed around, probably more than necessary. This can lead to a lot of chasing things down to find where the work in response to a user action is actually done. An unfortunate example of these callbacks is that models are equipped with a callback that forces their corresponding React component to update. Undoubtedly this points to an architectural flaw.

## Models and Pieces

Models (StoryBuilder, StoryArea, MomentsManager, and Moment) are responsible for maintaining the plugin state and for handling transactions with CODAP.

Pieces are the React component classes that manage the UI. These classes own or point to the models and handle user-initiated changes by passing off responsibility to these models.

## Models

### StoryBuilder
* Responsible for initialization including creation of StoryArea.
* Holds no state itself.

### StoryArea
* Creates initial text component and initial moment if these are not created as part of restoring state. Handles synchronization between the moment and the text component.
* Receives notifications from CODAP
* Manages what should be displayed in dialog boxes the user sees and what happens in response to user actions in those dialog boxes
* Initiates requests for CODAP's current state, setting flags to be queried on the asynchronous receipt of that state.

### MomentsManager
* Responsible for managing data contexts by keeping a set of master contexts and by determining how to deal with a data context that is part of a CODAP state.
* Maintains a linked list of Moment objects and handles transitions from one moment to another.
* Handles user actions that add a new moment, delete an existing moment, and reposition a given moment.
* Handles save/restore of the linked list of moments. When a plugin state from a previous version of StoryBuilder is encountered, manages backward compatibility by creating needed master data contexts and diffs.
* Owns the DiffPatcher from the jsondiffpatch module.

### Moment
* Maintains the state of each moment including the corresponding CODAP state plus diffs for data contexts in that state.
* Tracks ephemeral changes such as whether the Moment is active, whether current CODAP state is changed compared to the Moment's copy of that state, and whether the Moment is brand new.

## Pieces (React Components)

### StoryBuilderComponent
* Displays the StoryAreaComponent, HelpButton and LockButton
* Creates and owns the StoryBuilder model

### StoryAreaComponent
* Renders moments. During drag renders the placement indicator. When user must make a decision about changes, renders the dialog box.
* Handles drag and drop of individual moments
* Handles user interaction with moments
* Has pointers to StoryArea and MomentsManager

### MomentComponent
* Renders delete button and other controls. Renders moment number and editable moment title area.
* Handles low-level interactions with controls, mostly by passing them up the chain through callbacks.

### Other Pieces
* **ControlArea**—manages the three buttons with which the user reverts CODAP state, saves CODAP state or adds a new moment.
* **Dialog**—Manages user interaction during a decision process about what to do with changes during a transition to a different moment.
* **TitleEditor**—Manages text area, especially keystrokes
* **HelpButton** and **LockButton**—Simple buttons
* **EmptyMoment**—Basically a button to create a first moment when there aren't any

## Using Differencing of Data Contexts to Minimize File Size

Up through version 0.76 each moment contains a full copy of the document state, including any data contexts. When a new moment is created and saved a new copy of data contexts is stored regardless of anything in them was changed. This leads to file bloat.

To vastly decrease file bloat, we propose to store a _master_ copy of each data context when it is first encountered. When state is stored in a moment, for each data context,
1. determine if it already exists and, if not, store it as a new master
    1. compute the diff
    2. If the diff has size > 2/3 the size of the master, store the new master along with the previous master and with a sub-id
    3. In the moment store the id, sub-id, and patch of 0 bytes to the new master
2. To determine which sub-master to diff from
    1. If the moment already has a previous patch, try that master first
    2. If that patch is now too big, determine whether one of the other sub-masters and choose the one, if found, that has an acceptable size.

Each moment that contains that data context will store a _difference_ between its version and the master.

### Notes
* Data contexts are identified by their IDs
* Master data contexts are stored in a hash keyed by ID with context object values
* When a moment is saved, the following happens:
    * CODAP is queried for an object representing the current state
    * For each data context in this document object
        * If it is new, store it in the master object and store a null difference patch in the moment's dataContextDifference object.
        * If its ID is already in the master object, create a patch from the master to the existing one and store it in the moment's dc_patches object with its ID being the key
            * Note that moments _only ever store patches_ for data contexts
        * Remove any data contexts in the document object
        * Store the remainder of the document object as codapState
* When the user requests that the state be changed to that of a different moment
    * Reconstruct a document object from the codapState stored in the moment
    * For each value in the moment's dc_patches object
        * Apply the patch to the stringified data context in the master object
        * Add the data context object to the reconstructed document object
    * Pass the document object to CODAP for reinstatement
* When to delete a data context from the master object?
    * After a moment is saved, determine for each data context in the master object whether its ID is the ID attached to any moment's patch
        * If not, delete the data context from the master object
* For backward compatibility
    * When the plugin is told to restorePluginState, go through the codapState of each moment
        * When a data context is encountered in that state for the first time, store it as a JSON string in the master data context object
        * For a data context already present, create a patch and store that