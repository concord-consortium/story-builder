# Story Builder Plugin Architecture 

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