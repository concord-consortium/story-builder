import {MomentsManager} from "./moments-manager";
import codapInterface from "../lib/CodapInterface";
import {Moment, StateObject} from "./moment";
import {
	kNarrativeTextBoxName,
	needNarrativeTextBox, setBusyIndicator,
} from "../utilities/utilities";
import {kSBVersion} from "./story_builder";
import tr from "../utilities/translate";

export class StoryArea {

	/**
	 * Tests the given object, returning true if it is not an object or is an object with no values for any property
	 * @param iObject
	 * @private
	 */
	private static stateObjectIsEmpty(iObject: any): boolean {
		return !iObject || typeof iObject !== 'object' || Object.keys(iObject).length === 0 ||
			Object.values(iObject).every((iValue: any) => {
				return !iValue
			});
	}

	private stateStrings = {
		qClickAnotherMoment: {
			explanation: tr("DG.plugin.StoryBuilder.storyArea.qClickAnotherMomentExplanation")
		},
		qDupNotLastMoment: {
			prompt: tr("DG.plugin.StoryBuilder.storyArea.qDupNotLastMomentPrompt"),
			explanation: tr("DG.plugin.StoryBuilder.storyArea.qDupNotLastMomentExplanation"),
			labeledCallbacks: [
				{label: tr("DG.plugin.StoryBuilder.storyArea.dialog.discard")},
				{label: tr("DG.plugin.StoryBuilder.storyArea.qDupNotLastMomentTwoMoments")},
				{label: tr("DG.plugin.StoryBuilder.storyArea.qDupNotLastMomentOneMoment")}
			]
		},
		qRevert: {
			explanation: tr("DG.plugin.StoryBuilder.storyArea.qRevertExplanation"),
		},
		qClickLock: {
			explanation: tr("DG.plugin.StoryBuilder.storyArea.qClickLockExplanation")
		}
	};

	public momentsManager: MomentsManager = new MomentsManager();
	public isAutoSave: boolean = false;
	private restoreInProgress = false;
	private waitingForDocumentState = false;
	private saveStateInSrcMoment = false;
	private saveStateInDstMoment = false;
	private changeCount = 0;
	private narrativeBoxID: number = 0;
	private justMadeInitialMomentAndText = false;
	private restoringCodapStateInProgress = false;
	private pingCallback: Function | null = null;
	private forceUpdateCallback: Function | null = null;

	constructor() {
		this.handleNotification = this.handleNotification.bind(this);
		this.deleteCurrentMoment = this.deleteCurrentMoment.bind(this);
		this.revertCurrentMoment = this.revertCurrentMoment.bind(this);
		this.makeNewMoment = this.makeNewMoment.bind(this);
		this.handleNewTitle = this.handleNewTitle.bind(this);
		this.saveCurrentMoment = this.saveCurrentMoment.bind(this);
		this.getPluginState = this.getPluginState.bind(this);
		this.restorePluginState = this.restorePluginState.bind(this);
		this.handleCancel = this.handleCancel.bind(this);
		this.handleDiscard = this.handleDiscard.bind(this);
		this.handleSave = this.handleSave.bind(this);
		this.handleSaveToLock = this.handleSaveToLock.bind(this);
		this.handleDiscardToLock = this.handleDiscardToLock.bind(this);
		this.handleOnlyNew = this.handleOnlyNew.bind(this);
		this.handleSaveToBoth = this.handleSaveToBoth.bind(this);

		codapInterface.on('notify', '*', '', this.handleNotification);
		codapInterface.on('get', 'interactiveState', '', this.getPluginState);
		codapInterface.on('update', 'interactiveState', '', this.restorePluginState);
	}

	setupDialogStates(): any {
		const template = this.stateStrings;
		return {
			qClickAnotherMoment: {
				prompt: tr("DG.plugin.StoryBuilder.storyArea.qClickAnotherMomentPrompt"),
				explanation: template.qClickAnotherMoment.explanation.slice(),
				labeledCallbacks: [
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.cancel"),
						callback: this.handleCancel
					},
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.discard"),
						callback: this.handleDiscard
					},
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.save"),
						callback: this.handleSave
					}
				]
			},
			qDupNotLastMoment: {
				prompt: template.qDupNotLastMoment.prompt.slice(),
				explanation: template.qDupNotLastMoment.explanation.slice(),
				labeledCallbacks: [
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.discard"),
						callback: this.handleDiscard
					},
					{
						label: template.qDupNotLastMoment.labeledCallbacks[1].label.slice(),
						callback: this.handleSaveToBoth
					},
					{
						label: template.qDupNotLastMoment.labeledCallbacks[2].label.slice(),
						callback: this.handleOnlyNew
					}
				]
			},
			qRevert: {
				prompt: tr("DG.plugin.StoryBuilder.storyArea.qRevertPrompt"),
				explanation: template.qRevert.explanation.slice(),
				labeledCallbacks: [
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.cancel"),
						callback: this.handleCancel
					},
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.discard"),
						callback: this.handleDiscard
					}
				]
			},
			qClickLock: {
				prompt: tr("DG.plugin.StoryBuilder.storyArea.qClickLockPrompt"),
				explanation: template.qClickAnotherMoment.explanation.slice(),
				labeledCallbacks: [
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.discard"),
						callback: this.handleDiscardToLock
					},
					{
						label: tr("DG.plugin.StoryBuilder.storyArea.dialog.save"),
						callback: this.handleSaveToLock
					}
				]
			}
		};
	}

	async initialize() {
		this.getSetIsAutoSave = this.getSetIsAutoSave.bind(this)
		/**
		 * We delay the start making the initial moment to let the text box appear;
		 * otherwise the text box will not be in that Moment's codapState.
		 */
		let theID = await needNarrativeTextBox();
		if (theID >= 0) {   //  there is a text box
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

	setPingCallback(iCallback: Function) {
		this.pingCallback = iCallback;
	}

	toggleIsAutoSave() {
		this.isAutoSave = !this.isAutoSave;
		let tSrcMoment = this.momentsManager.srcMoment
	}

	getSetIsAutoSave(iSetting?: boolean) {
		if (typeof iSetting === 'boolean') {
			this.isAutoSave = iSetting
			this.forceComponentUpdate()
		}
		return this.isAutoSave
	}

	setForceUpdateCallback(iCallback: Function) {
		this.forceUpdateCallback = iCallback;
	}

	forceComponentUpdate() {
		if (this.forceUpdateCallback)
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
		const tMoment = this.momentsManager.makeNewMomentUsingCodapState({contexts: []});   //  the unsaved moment has no state yet

		//  make initial text box
		const tNarrativeID: number = await needNarrativeTextBox()
			.catch(() => {
				console.log(`••• problem finding out about the narrative text box`);
				return 0;
			});

		if (tNarrativeID !== -1) {
			this.narrativeBoxID = tNarrativeID;

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
				.catch((reason) => {
					console.log(`••• problem creating the narrative text box because ${reason}`);
				});
			if (tResult && tResult.success) {
				this.narrativeBoxID = tResult.values.id;
			}
		}

		this.momentsManager.currentMoment = tMoment;
		await StoryArea.displayNarrativeAndTitleInTextBox(this.momentsManager.currentMoment);

		await this.doBeginTransitionToDifferentMoment(tMoment);

		this.forceComponentUpdate();     //  make the moment appear on the screen in the bar
		await this.saveCurrentMoment();
	}

	/**
	 * Responsible for handling the various notifications we receive
	 * when the user makes an undoable action,
	 * and also when CODAP responds to our requests to move to a different codapState
	 *
	 * @param iCommand    the Command resulting from the user action
	 */
	private async handleNotification(iCommand: any): Promise<any> {
		// CODAP lets us know when it is in the process of updating so we can ignore those notifications
		if (iCommand.resource === 'documentChangeNotice') {
			if (iCommand.values.operation === 'updateDocumentBegun') {
				this.restoringCodapStateInProgress = true;
				return;
			} else if (iCommand.values.operation === 'updateDocumentEnded') {
				this.restoringCodapStateInProgress = false;
				return;
			}
		}

		if (iCommand.resource !== 'undoChangeNotice' /*&&
			kIgnorableOperations.indexOf( iCommand.values.operation) === -1*/) {
			if (!this.restoringCodapStateInProgress) {
				//  console.log(`  notification! Resource: ${iCommand.resource}, operation: ${iCommand.values.operation}`);
				if (iCommand.values.operation === 'newDocumentState') {
					this.receiveNewDocumentState(iCommand);
				} else if (iCommand.values.operation === 'titleChange') {
					const textBoxComponentResourceString = `component[${this.narrativeBoxID}]`;
					if (iCommand.resource === textBoxComponentResourceString) {
						console.log(`TITLE changed to "${iCommand.values.to}... change count is ${this.changeCount}"`);
						this.momentsManager.setNewTitle(iCommand.values.to);
						this.forceComponentUpdate();
					} else {
						this.momentsManager.markCurrentMomentAsChanged(true);
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
	}

	private async matchCODAPStateToMoment(iMoment: Moment | null) {
		const newState = (iMoment) ? iMoment.codapState : null;
		const tMomentID = (iMoment) ? iMoment.ID : "null";  //  for catch error reporting
		if (iMoment && newState) {
			let tFullState = this.momentsManager.patchDataContexts(iMoment, newState);

			await this.restoreCodapState(tFullState)
				.catch((reason) => console.log(`••• caught matching CODAP state to moment [${tMomentID}] because ${reason}`));
			iMoment.setIsChanged(false);
			this.resetChangeCount();
		}
	}

	/**
	 * Asks CODAP to restore itself to the given state.
	 * Note: sets restoreInProgress while it's running and resolving its promises
	 * @param iFullCodapState the state to restore to. It contains patched dataContexts
	 */
	private async restoreCodapState(iFullCodapState: StateObject | null) {
		console.log(`begin restore state`);
		if (!StoryArea.stateObjectIsEmpty(iFullCodapState)) {
			await setBusyIndicator(true)
			this.restoreInProgress = true;
			await codapInterface.sendRequest({
				action: 'update',
				resource: 'document',
				values: iFullCodapState
			}).catch(() => {
				console.log(`•••  caught restoring CODAP state`)
			})
				.finally(async () => {
					setBusyIndicator(false)
				})

			console.log('end restore state');
			this.restoreInProgress = false;
			this.resetChangeCount();
		} else {
			console.log(`no state to restore`);
		}
	}

	restorePluginState(iStorage: any) {
		if (iStorage && iStorage.hasOwnProperty('momentsStorage')) {
			this.changeCount = iStorage.changeCount || 0
			this.isAutoSave = iStorage.isLocked || iStorage.isAutoSave || false;
			this.momentsManager.restoreFromStorage(iStorage.momentsStorage);
		} else {	// for backward compatibility
			this.momentsManager.restoreFromStorage(iStorage);
		}
		// Because the user might have saved the document without saving state in the current moment,
		// we do that now.
		this.saveStateInSrcMoment = true;
		this.momentsManager.srcMoment = this.momentsManager.currentMoment;

		this.forceComponentUpdate();
	}

	getPluginState() {
		if (this.waitingForDocumentState) {
			return {};
		} else {
			return {
				success: true,
				values: {
					changeCount: this.changeCount,
					isAutoSave: this.isAutoSave,
					fromVersion: kSBVersion,
					momentsStorage: this.momentsManager.createStorage()
				}
			};
		}
	}

	/**
	 * We ask for the document state using a get-document request.
	 * But the result cannot come back, even with _await_.
	 * So we set a flag which gets unset in a partner method, `receiveNewDocumentState`.
	 */
	private async requestDocumentState() {
		this.waitingForDocumentState = true;
		await codapInterface.sendRequest({action: 'get', resource: 'document'})
			.catch(() => {
				this.waitingForDocumentState = false;
			});
	}

	/**
	 * We are notified of a `newDocumentState` event.
	 * The current CodapState is in the iCommand.
	 * @param iCommand
	 */
	private receiveNewDocumentState(iCommand: any): void {
		if (this.waitingForDocumentState) {
			this.waitingForDocumentState = false;
			// console.log(`received a document state we were waiting for`);

			if (this.saveStateInSrcMoment) {
				this.momentsManager.matchMomentToCODAPState(this.momentsManager.srcMoment,
					iCommand.values.state, false);
			}
			if (this.saveStateInDstMoment) {
				this.momentsManager.matchMomentToCODAPState(this.momentsManager.dstMoment,
					iCommand.values.state, true);
			}
			this.resetChangeCount();
		} else {
			console.log(`received a document state --- but we were not waiting for one`);
		}
	}

	async handleMomentClick(iMoment: Moment) {
		if (iMoment) {
			await this.doBeginTransitionToDifferentMoment(iMoment);
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
	async makeNewMoment() {
		await this.doBeginTransitionToDifferentMoment(null);
	}

	public async handleNewTitle(iMoment: Moment, iNewTitle: string) {
		if (iNewTitle.length > 0) {
			iMoment.setTitle(iNewTitle);
			await StoryArea.displayTitleInTextBox(iMoment);
		}
		this.forceComponentUpdate();
	}

	async doBeginTransitionToDifferentMoment(iMoment: Moment | null) {
		if (!this.pingCallback) {
			console.log('pingCallback not initialized');
			return;
		}
		if (iMoment !== null && iMoment === this.momentsManager.currentMoment) {
			return;	// We're not going to a different moment
		}
		if (this.momentsManager.currentMoment) {
			let dialogMode = '';
			this.momentsManager.srcMoment = this.momentsManager.currentMoment;

			if (iMoment) {  //  a destination moment already exists
				this.momentsManager.dstMoment = iMoment;
				if (this.changeCount !== 0)
					dialogMode = 'qClickAnotherMoment';
			} else {        //  we are making a new moment
				if (this.momentsManager.srcMoment !== this.momentsManager.getLastMoment() &&
					this.changeCount !== 0)
					dialogMode = 'qDupNotLastMoment';
				this.momentsManager.dstMoment = this.momentsManager.makeNewMomentUsingCodapState({contexts: null});
			}

			//  We are now guaranteed that srcMoment and dstMoment are Moments, not null.
			//	We must determine where changes should be saved, if at all
			this.saveStateInSrcMoment = this.isAutoSave;
			this.saveStateInDstMoment = false;

			if (dialogMode === '' || this.isAutoSave) {
				//  whenever you're going from a "new" moment, you must save its state
				this.saveStateInSrcMoment = this.isAutoSave || StoryArea.stateObjectIsEmpty(this.momentsManager.srcMoment.codapState) ||
					this.changeCount !== 0
				this.saveStateInDstMoment = StoryArea.stateObjectIsEmpty(this.momentsManager.dstMoment.codapState);
				if (this.saveStateInSrcMoment || this.saveStateInDstMoment) {
					await this.requestDocumentState();	// When received it will be saved in Src and/or Dst moment
				}
				if (!this.saveStateInDstMoment) {
					await this.matchCODAPStateToMoment(this.momentsManager.dstMoment);
				}
				this.momentsManager.setCurrentMoment(this.momentsManager.dstMoment);
				await StoryArea.displayNarrativeAndTitleInTextBox(this.momentsManager.dstMoment);
				this.forceComponentUpdate();
			} else {
				// There are changes so we have to set up for asynchronous feedback from user
				let tChosenState = this.setupDialogStates()[dialogMode],
					tSrcMoment = this.momentsManager.srcMoment;
				tChosenState.srcMoment = this.momentsManager.srcMoment;
				tChosenState.dstMoment = this.momentsManager.dstMoment;
				tChosenState.mode = dialogMode;
				switch (dialogMode) {
					case 'qClickAnotherMoment':
						tChosenState.explanation = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber);
						break;
					case 'qDupNotLastMoment':
						tChosenState.prompt = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber + 1);
						tChosenState.explanation = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber);
						tChosenState.explanation = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber);
						tChosenState.explanation = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber + 1);
						tChosenState.explanation = tChosenState.explanation.replace('%@', tSrcMoment.momentNumber + 1);
						tChosenState.labeledCallbacks[2].label = tChosenState.labeledCallbacks[2].label.replace('%@', tSrcMoment.momentNumber + 1);
						tChosenState.labeledCallbacks[1].label = tChosenState.labeledCallbacks[1].label.replace('%@', tSrcMoment.momentNumber);
						tChosenState.labeledCallbacks[1].label = tChosenState.labeledCallbacks[1].label.replace('%@', tSrcMoment.momentNumber + 1);
						break;
					default:
						console.log('Unexpected lack of dialog mode')
				}
				this.pingCallback(tChosenState);
			}
		} else {
			//  happens when there is no current moment; so make a new one.
			await this.makeInitialMomentAndTextComponent()
		}
	}

	pingToNormal() {
		if (this.pingCallback)
			this.pingCallback(null);	// signals story area component to go back to normal
	}

	/**
	 * The user has pressed Cancel on one of three different dialog boxes. We just want things to go back to normal
	 * without any changes to story area.
	 */
	handleCancel() {
		this.pingToNormal();
	}

	/**
	 * In a discard, we want to reinstate the source moment's state in CODAP and go on to make the
	 * destination moment the current moment.
	 * @param iDialogState
	 */
	async handleDiscard(iDialogState: any) {
		await this.matchCODAPStateToMoment(iDialogState.srcMoment);
		await this.doBeginTransitionToDifferentMoment(iDialogState.dstMoment);
		this.pingToNormal();
	}

	/**
	 * The user has made changes in the current moment and is about to move on to another, pre-existing moment.
	 * They have chosen to save the changes in the current moment.
	 * @param iDialogState
	 */
	async handleSave(iDialogState: any) {
		await this.saveCurrentMoment();
		await this.matchCODAPStateToMoment(iDialogState.dstMoment);
		await StoryArea.displayNarrativeAndTitleInTextBox(iDialogState.dstMoment);
		this.momentsManager.setCurrentMoment(iDialogState.dstMoment);
		this.pingToNormal();
	}

	/**
	 * The user has made changes in the current moment and is about to lock. They have chosen to save
	 * the current moment
	 */
	async handleSaveToLock() {
		await this.saveCurrentMoment();
		this.resetChangeCount();
		this.pingToNormal();
	}

	/**
	 * The user has made changes in the current moment and is about to lock. They have chosen to save
	 * the current moment
	 */
	async handleDiscardToLock() {
		console.log('handleDiscardToLock', this.momentsManager.currentMoment);
		await this.matchCODAPStateToMoment(this.momentsManager.currentMoment);
		this.pingToNormal();
	}

	/**
	 * The user has made a change in the current moment which is not the last moment. Then pressed Duplicate and,
	 * in the resulting dialog box specified they only want the changes to appear in the new moment.
	 * What this amounts to is leaving CODAP in its current state and moving to the new moment—dstMoment.
	 * @param iDialogState
	 */
	async handleOnlyNew(iDialogState: any) {
		let tNewMoment = iDialogState.dstMoment;
		await StoryArea.displayNarrativeAndTitleInTextBox(tNewMoment);
		this.momentsManager.setCurrentMoment(tNewMoment);
		tNewMoment.setIsChanged(true);	// Because we know there are changes
		this.pingToNormal();
	}

	/**
	 * The user has made a change in the current moment which is not the last moment. Then pressed Duplicate and,
	 * in the resulting dialog box specified they want the changes to be part of both the current moment and the new moment.
	 *
	 * @param iDialogState
	 */
	async handleSaveToBoth(iDialogState: any) {
		this.saveStateInSrcMoment = true;
		this.saveStateInDstMoment = true;
		await this.requestDocumentState();
		/*
				this.resetChangeCount();
				await this.doBeginTransitionToDifferentMoment( iDialogState.dstMoment);
		*/
		this.pingToNormal();
	}

	/**
	 * Update the current moment so that its codapState matches the document
	 */
	async saveCurrentMoment() {
		if (this.momentsManager.currentMoment) {
			this.momentsManager.srcMoment = this.momentsManager.dstMoment = this.momentsManager.currentMoment;
			this.saveStateInSrcMoment = true;
			await this.requestDocumentState();
			// console.log(`Explicitly saved [${this.momentsManager.currentMoment.title}] in saveCurrentMoment`);
		} else {
			alert(`There is no current moment to save`);
		}
	}

	async deleteCurrentMoment() {
		this.momentsManager.deleteCurrentMoment();    //  also sets a new currentMoment
		// console.log(`moment removed from momentsManager; ready to match to new current moment`);
		await this.matchCODAPStateToMoment(this.momentsManager.currentMoment);
	}

	/**
	 * Make CODAP revert to the last-saved state associated with the currentMoment.
	 */
	public revertCurrentMoment(): void {
		this.matchCODAPStateToMoment(this.momentsManager.currentMoment);
	}

	public static async displayNarrativeAndTitleInTextBox(iMoment: Moment | null) {
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
