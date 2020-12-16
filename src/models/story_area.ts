import {MomentsManager} from "./moments-manager";
import codapInterface from "../lib/CodapInterface";
import {Moment} from "./moment";
import {
	kNarrativeTextBoxName,
	needNarrativeTextBox, objectIsEmpty,
	putTextComponentInfoIntoCodapState
} from "../utilities/utilities";

export class StoryArea {

	public momentsManager:MomentsManager = new MomentsManager();
	private restoreInProgress = false;
	private waitingForDocumentState = false;
	private saveStateInSrcMoment = false;
	private saveStateInDstMoment = false;
	private changeCount = 0;
	private narrativeBoxID: number = 0;
	private justMadeInitialMomentAndText = false;
	private forceUpdateCallback:Function | null = null;

	constructor() {
		this.handleNotification = this.handleNotification.bind(this);
		this.deleteCurrentMoment = this.deleteCurrentMoment.bind(this);
		this.updateCurrentMoment = this.updateCurrentMoment.bind(this);
		this.revertCurrentMoment = this.revertCurrentMoment.bind(this);
		this.makeNewMoment = this.makeNewMoment.bind(this);
		this.handleNewTitle = this.handleNewTitle.bind(this);
		this.saveCurrentMoment = this.saveCurrentMoment.bind(this);
		this.getPluginState = this.getPluginState.bind(this);
		this.restorePluginState = this.restorePluginState.bind(this);

		codapInterface.on('notify', '*', '', this.handleNotification);
		codapInterface.on('get', 'interactiveState', '', this.getPluginState);
		codapInterface.on('update', 'interactiveState', '', this.restorePluginState);
	}

	async initialize() {
		/**
		 * We delay the start making the initial moment to let the text box appear;
		 * otherwise the text box will not be in that Moment's codapState.
		 */
		let theID = await needNarrativeTextBox();
		if (theID >= 0) {   //  there is a text box with a nonzero ID
			console.log(`StoryArea constructor: initial text box found with ID ${theID}`);
			this.narrativeBoxID = theID;
		} else {
			if (!this.momentsManager.startingMoment) {
				this.justMadeInitialMomentAndText = true;
				await this.makeInitialMomentAndTextComponent();
			} else {
				this.forceComponentUpdate();
			}
		}
	}

	setForceUpdateCallback( iCallback:Function) {
		this.forceUpdateCallback = iCallback;
	}

	forceComponentUpdate() {
		if( this.forceUpdateCallback)
			this.forceUpdateCallback();
	}

	resetChangeCount() {
		this.changeCount = 0;
	}

	/**
	 * Called from the constructor if there is no existing narrative text box
	 * Also called if user makes a new moment and there are none currently.
	 */
	async makeInitialMomentAndTextComponent(): Promise<void> {
		const tMoment = this.momentsManager.makeNewMomentUsingCodapState({});   //  the unsaved moment has no state yet

		//  make initial text box
		const tNarrativeID: number = await needNarrativeTextBox()
			.catch(() => {
				console.log(`••• problem finding out about the narrative text box`);
				return 0;
			});

		if (tNarrativeID !== -1) {
			this.narrativeBoxID = tNarrativeID;
			console.log(`StoryArea.makeInitialMomentAndTextComponent: Text box id ${this.narrativeBoxID} found.`);

		} else {
			const theMessage = {
				action: "create",
				resource: "component",
				values: {
					type: "text",
					name: kNarrativeTextBoxName,
					title: tMoment.title,
					cannotClose: true,
					text: tMoment.narrative,
				}
			};

			const tResult: any = await codapInterface.sendRequest(theMessage)
				.catch(() => {
					console.log(`••• problem creating the narrative text box`)
				});
			if (tResult.success) {
				this.narrativeBoxID = tResult.values.id;
				console.log(`StoryArea.makeInitialMomentAndTextComponent: Text box id ${this.narrativeBoxID} created.`);
			}
		}

		//      at this point, `tMoment.codapState` is still null.

		this.momentsManager.currentMoment = tMoment;
		await StoryArea.displayNarrativeAndTitleInTextBox(this.momentsManager.currentMoment);

		this.forceComponentUpdate();     //  make the moment appear on the screen in the bar
	}

	/**
	 * Responsible for handling the various notifications we receive
	 * when the user makes an undoable action,
	 * and also when CODAP respomds to our requests to move to a different codapState
	 *
	 * @param iCommand    the Command resulting from the user action
	 */
	private async handleNotification(iCommand: any): Promise<any> {
		console.log(JSON.stringify(iCommand));
		if (iCommand.resource !== 'undoChangeNotice') {
			//  console.log(`  notification! Resource: ${iCommand.resource}, operation: ${iCommand.values.operation}`);
			if (iCommand.values.operation === 'newDocumentState') {
				this.receiveNewDocumentState(iCommand);
			} else if (iCommand.values.operation === 'titleChange') {
				const textBoxComponentResourceString = `component[${this.narrativeBoxID}]`;
				if (iCommand.resource === textBoxComponentResourceString) {
					console.log(`TITLE changed to "${iCommand.values.to}... change count is ${this.changeCount}"`);
					this.momentsManager.setNewTitle(iCommand.values.to);
					this.forceComponentUpdate();
				}
			} else if (iCommand.values.operation === 'commitEdit' &&
				iCommand.values.id === this.narrativeBoxID) {
				this.momentsManager.setNewNarrative(iCommand.values.text);
			} else if (!(this.justMadeInitialMomentAndText || this.restoreInProgress)) {
				this.momentsManager.markCurrentMomentAsChanged(true);
				this.changeCount++;
			} else {
				this.justMadeInitialMomentAndText = false;
			}
		}
	}

	private async matchCODAPStateToMoment(iMoment: Moment | null) {
		const newState = (iMoment) ? iMoment.codapState : null;
		const tMomentID = (iMoment) ? iMoment.ID : "null";  //  for catch error reporting

		await this.restoreCodapState(newState)
			.catch(() => console.log(`••• caught matching CODAP state to moment [${tMomentID}]`));
	}

	/**
	 * Asks CODAP to restore itself to the given state.
	 * Note: sets restoreInProgress while it's running and resolving its promises
	 * @param iCodapState    the state to restore to; this is the potentially large JSON object
	 */
	private async restoreCodapState(iCodapState: object | null): Promise<any> {
		let out: any = null;
		console.log(`begin restore state`);
		if (iCodapState) {
			let this_ = this;
			this.restoreInProgress = true;
			out = await codapInterface.sendRequest({
				action: 'update',
				resource: 'document',
				values: iCodapState
			}).catch(() => {
				console.log(`•••  caught restoring CODAP state`)
			})

			console.log('end restore state');
			this_.restoreInProgress = false;
			this.resetChangeCount();
		} else {
			console.log(`no state to restore`);
		}

		return out;
	}

	restorePluginState(iState:any) {
		this.momentsManager.restoreFromStorage(iState);
		this.forceComponentUpdate();
	}

	getPluginState(): any {
		if (this.waitingForDocumentState) {
			return {};
		} else {
			return {
				success: true,
				values: this.momentsManager.createStorage()
			};
		}
	}

	/**
	 * We ask for the document state using a get-document request.
	 * But the result cannot come back, even with _await_.
	 * So we set a flag which gets unset in a partner method, `receiveNewDocumentState`.
	 */
	private requestDocumentState(): void {
		this.waitingForDocumentState = true;
		codapInterface.sendRequest({action: 'get', resource: 'document'});
		console.log(`Requesting a document state, currentMoment is [${this.momentsManager.getCurrentMomentTitle()}]`)
	}

	/**
	 * We are notified of a `newDocumentState` event.
	 * The current CodapState is in the iCommand.
	 * @param iCommand
	 */
	private receiveNewDocumentState(iCommand: any): void {
		if (this.waitingForDocumentState) {
			this.waitingForDocumentState = false;
			console.log(`received a document state we were waiting for`);

			if (this.saveStateInSrcMoment) {
				StoryArea.matchMomentToCODAPState(this.momentsManager.srcMoment, iCommand.values.state, false);
			}
			if (this.saveStateInDstMoment) {
				StoryArea.matchMomentToCODAPState(this.momentsManager.dstMoment, iCommand.values.state, true);
			}
			this.doEndChangeToNewMoment();
		} else {
			console.log(`received a document state --- but we were not waiting for one`);
		}
	}

	async handleMomentClick(iMoment:Moment) {
		if( iMoment) {
			this.doBeginChangeToNewMoment(iMoment);
			this.momentsManager.setCurrentMoment(iMoment);
			await StoryArea.displayNarrativeAndTitleInTextBox(iMoment);
		}
	}

	/**
	 * invoked when the user presses the "shutter" button.
	 * We will by default store the current CODAP state
	 * in the codapState of the marker.
	 *
	 * So we need the state from CODAP itself.
	 * We actually receive the state in handleNotification(). This just makes the request.
	 */
	public makeNewMoment() {
		this.doBeginChangeToNewMoment(null);
	}

	public async handleNewTitle( iMoment:Moment, iNewTitle:string) {
		if (iNewTitle.length > 0) {
			iMoment.setTitle(iNewTitle);
			await StoryArea.displayTitleInTextBox(iMoment);
		}
		this.forceComponentUpdate();
	}

	doBeginChangeToNewMoment(iMoment: Moment | null) {

		if (this.momentsManager.currentMoment) {
			this.momentsManager.srcMoment = this.momentsManager.currentMoment;

			if (iMoment) {  //  a destination moment already exists
				this.momentsManager.dstMoment = iMoment;
			} else {        //  we are making a new moment
				this.momentsManager.dstMoment = this.momentsManager.makeNewMomentUsingCodapState({});
				this.momentsManager.dstMoment.setIsNew(true);
				//  it is not yet the current moment
			}

			//  we are now guaranteed that srcMoment and dstMoment are Moments, not null.

			const qSaveChanges =
				`You have made ${this.changeCount === 1 ? "a change" : "some changes"}. ` +
				`Would you like to save ${this.changeCount === 1 ? "it" : "them"} in [${this.momentsManager.getCurrentMomentTitle()}]?`;
			const qChangesStayOnScreen = `The new moment you're making will be called [${this.momentsManager.dstMoment.title}]. ` +
				`Would you like these changes to appear in [${this.momentsManager.dstMoment.title}]?`;

			this.saveStateInSrcMoment = false;
			this.saveStateInDstMoment = false;

			if (objectIsEmpty(this.momentsManager.srcMoment.codapState)) {
				//  whenever you're going from a "new" moment, you must save its state.
				//  this is a convenience; we could ask.
				this.saveStateInSrcMoment = true;
			} else if (this.changeCount === 0) {
				//  no changes? We'll effectively save, but we won't ask.
				this.saveStateInSrcMoment = true;       //  could be false..shouldn't matter, right?
			} else if (window.confirm(qSaveChanges)) {
				//  there have been changes, so we will save.
				this.saveStateInSrcMoment = true;
			} else if (!objectIsEmpty(this.momentsManager.dstMoment.codapState)
				&& window.confirm(qChangesStayOnScreen)) {
				//  so we're NOT saving changes in the source, but do we want them in the destination
				this.saveStateInDstMoment = true;
			} else {
				//  we don't want to save the srcMoment. Nor in the dst.
			}
			this.requestDocumentState();
		} else {
			//  happens when there is no current moment; so make a new one.
			this.makeInitialMomentAndTextComponent()
		}
	}

	/**
	 * Utility to update the given moment with the given state.
	 *
	 * @param iMoment
	 * @param iState
	 * @param preserveMomentInfo    should the info in the MomentModel (title and narrative)
	 *                              be stored in the codapState as part of the text component?
	 *
	 */
	private static async matchMomentToCODAPState(iMoment: Moment | null, iState: object, preserveMomentInfo: boolean): Promise<void> {
		if (iMoment instanceof Moment) {
			console.log(`Setting [${iMoment.title}] to match a state`);
			iMoment.setCodapState(iState);
			iMoment.modified = new Date();
			iMoment.setIsChanged(false);	// because we've saved state

			if (preserveMomentInfo) {
				putTextComponentInfoIntoCodapState({
					title: iMoment.title,
					narrative: iMoment.narrative
				}, iMoment.codapState);
			}
		}
	}

	private async doEndChangeToNewMoment(): Promise<void> {

		this.momentsManager.currentMoment = this.momentsManager.dstMoment;

		await this.matchCODAPStateToMoment(this.momentsManager.currentMoment)
			.catch(() => {
				console.log(`••• problem matching the codap state 
            to [${this.momentsManager.getCurrentMomentTitle()}]`)
			});
		await StoryArea.displayNarrativeAndTitleInTextBox(this.momentsManager.currentMoment);

		// this.forceComponentUpdate();

		console.log(this.momentsManager.getMomentSummary());
	}

	saveCurrentMoment() {
		if (this.momentsManager.currentMoment) {
			this.momentsManager.srcMoment = this.momentsManager.dstMoment = this.momentsManager.currentMoment;
			this.saveStateInSrcMoment = true;
			this.requestDocumentState();
			console.log(`Explicitly saved [${this.momentsManager.currentMoment.title}] in saveCurrentMoment`);
		} else {
			alert(`Hmmm. There is no current moment to save`);
		}
	}

	private deleteCurrentMoment(): void {
		this.momentsManager.deleteCurrentMoment();    //  also sets a new currentMoment
		console.log(`moment removed from momentsManager; ready to match to new current moment`);
		this.matchCODAPStateToMoment(this.momentsManager.currentMoment);
	}

	/**
	 * Update the current moment so that its codapState matches the document
	 */
	private updateCurrentMoment(): void {
		if (this.momentsManager.currentMoment) {
			this.saveStateInSrcMoment = true;
			this.saveStateInDstMoment = true;
			this.momentsManager.srcMoment = this.momentsManager.currentMoment;
			this.momentsManager.dstMoment = this.momentsManager.currentMoment;

			this.requestDocumentState();
		}
	}

	/**
	 * Make CODAP revert to the last-saved state associated with the currentMoment.
	 */
	private revertCurrentMoment(): void {
		this.matchCODAPStateToMoment(this.momentsManager.currentMoment);

		//  this.forceComponentUpdate();     //  in case there's any change
	}

	private static async displayNarrativeAndTitleInTextBox( iMoment:Moment | null) {
		await StoryArea.displayNarrativeInTextBox(iMoment);
		await StoryArea.displayTitleInTextBox(iMoment);
	}

	/**
	 * Given a Moment, display its narrative in the narrative text box
	 * @param iMoment
	 */
	private static async displayTitleInTextBox(iMoment: Moment | null): Promise<void> {
		let momentTitleString;
		if (iMoment) {
			momentTitleString = iMoment.title;
		} else {
			momentTitleString = "No moments!";
		}
		const textBoxObject = {
			type: "text",
			name: kNarrativeTextBoxName,
			title: momentTitleString
		};

		const theMessage = {
			action: "update",
			resource: "component[" + kNarrativeTextBoxName + "]",
			values: textBoxObject
		};

		await codapInterface.sendRequest(theMessage)
			.catch(() => {
				console.log(`••• problem updating the narrative text box`)
			});
	}

	/**
	 * Given a Moment, display its narrative in the narrative text box
	 * @param iMoment
	 */
	private static async displayNarrativeInTextBox(iMoment: Moment | null): Promise<void> {
		let narrativeString;
		if (iMoment) {
			narrativeString = iMoment.narrative;
		} else {
			narrativeString = "Press the shutter to save a Moment in the Story Builder.";
		}
		const textBoxObject = {
			type: "text",
			name: kNarrativeTextBoxName,
			text: narrativeString,
		};

		const theMessage = {
			action: "update",
			resource: "component[" + kNarrativeTextBoxName + "]",
			values: textBoxObject
		};

		await codapInterface.sendRequest(theMessage)
			.catch(() => {
				console.log(`••• problem updating the narrative text box`)
			});
	}

}