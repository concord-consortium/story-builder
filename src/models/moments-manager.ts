/**
 * The MomentManager handles creation, save, restore, etc for moments, but NOT display.
 * 	(Used to be Timeline)
 **/
import {Moment, StateObject} from "./moment";
import {DiffPatcher, Delta} from "jsondiffpatch";
import sizeof from "object-sizeof";
import {putTextComponentInfoIntoCodapState} from "../utilities/utilities";

export class MomentsManager {
	public currentMoment: Moment | null = null;
	public dstMoment: Moment | null = null;
	public srcMoment: Moment | null = null;
	public startingMoment: Moment | null = null;
	private diffPatcher = new DiffPatcher({
		objectHash: function(obj, index) {
			// try to find an id property, otherwise just use the index in the array
			return obj.id || '$$index:' + index;
		}
	});
	private masterContextsObject: { [index:number]: {[index:number]:object}} = {};	// First index is context ID, second index is subIndex
	private nextMomentID: number = 0;
	private kInitialJSONText = `{"object":"value","document":{"children":[{"type":"paragraph","children":[{"text":"What did you do? Why did you do it?"}]},{"type":"paragraph","children":[{"text":"¿Qué hizo? ¿Por qué?"}]}],"objTypes":{"paragraph":"block"}}}`;
	private kInitialJSONText_start = `{"object":"value","document":{"children":[{"type":"paragraph","children":[{"text":"This is the beginning of your data story."}]},{"type":"paragraph","children":[{"text":"Esto es el comienzo de su cuento de datos."}]}],"objTypes":{"paragraph":"block"}}}`;

	constructor() {
	}

	getCurrentMomentTitle(): string {
		return (this.currentMoment) ? this.currentMoment.title : "";
	}

	patchDataContexts(iMoment:Moment, iPartialState:StateObject):StateObject {
		const tMasterContexts = this.masterContextsObject;
		let tPatchedState = this.diffPatcher.clone(iPartialState),
			this_ = this;
		tPatchedState.contexts = [];
		if( iMoment && iMoment.dcDiffs && iPartialState) {
			Object.keys(iMoment.dcDiffs).forEach((iID)=>{
				let tSubIndex = iMoment.dcDiffs[Number(iID)].subIndex,
					tPatchedContext = this_.diffPatcher.clone(tMasterContexts[Number(iID)][tSubIndex]),
					tPatch = iMoment.dcDiffs[Number(iID)].diff;
				// @ts-ignore
				if( Object.keys(tPatch).length > 0)
					this_.diffPatcher.patch(tPatchedContext, <Delta>tPatch);
				// @ts-ignore
				tPatchedState.contexts.push( tPatchedContext);
				let tPatchSize = sizeof(tPatch),
					tContextSize = sizeof(tPatchedContext);
				console.log(`patchDataContexts: Patch of size ${tPatchSize} is ${Number((tPatchSize / tContextSize).toFixed(5))} of context size of ${tContextSize}`);
			})
		}
		return tPatchedState;
	}

	processDataContexts(iMoment:Moment, iNewCodapState:StateObject) {

		function findOrCreateOptimalMaster( iNewContext:any, iCurrentSubIndex:number, iContextSize:number, iFoundPatchSize:number) {
			/**
			 * We've already determined that there is a master context with the given subIndex, but the patch required
			 * is more than kThreshold in size of that master context.
			 * Our task is first to determine if there is another master context (with a different subIndex) such that
			 * the required patch is less than kThreshold in size of that master context. If we find one, we use it.
			 * If we don't find one, we store the new context as a master context with a new subIndex.
			 */
			let tID = iNewContext.id,
				tNewSubIndex = 0,
				tExistingIndices:string[] = Object.keys(this_.masterContextsObject[tID]),
				tFoundGoodMaster = false,
				tBestSubIndex = -1,
				tBestFoundPatchSize = iFoundPatchSize,
				tBestPatch:Delta = {};
			tExistingIndices.forEach(iSubIndex=>{
				if( Number(iSubIndex) !== iCurrentSubIndex) {
					let tPatch = this_.diffPatcher.diff(this_.masterContextsObject[tID][Number(iSubIndex)], iNewContext),
						tPatchSize = sizeof(tPatch);
					if( !tPatch)
						tPatch = {};
					if( tPatchSize < tBestFoundPatchSize) {
						tBestFoundPatchSize = tPatchSize;
						tBestPatch = tPatch;
						tFoundGoodMaster = tFoundGoodMaster || (tPatchSize / iContextSize <= kThreshold);
						if( tFoundGoodMaster)
							tBestSubIndex = Number(iSubIndex);
					}
				}
			});
			if( tFoundGoodMaster) {
				console.log(`Found good master with subIndex ${tBestSubIndex} and size ${tBestFoundPatchSize}`);
				iMoment.dcDiffs[tID] = { subIndex: tBestSubIndex, diff: tBestPatch}
			}
			else {
				while (tExistingIndices.includes(String(tNewSubIndex))) {
					tNewSubIndex++;
				}
				this_.masterContextsObject[tID][tNewSubIndex] = iNewContext;
				iMoment.dcDiffs[tID] = {subIndex: tNewSubIndex, diff: {}};
				console.log(`Installed new master context with subIndex ${tNewSubIndex}`);
			}
		}

		const kThreshold = 0.5;	// If we encounter a patch that is more than this fraction of master size, make a new master
		let this_ = this;
		if( iNewCodapState) {
			if (iNewCodapState.contexts) {
				iNewCodapState.contexts.forEach((iContext:any) => {
					let tMasterContext: any;
					const kID = iContext.id,
						tSubIndex = iMoment.dcDiffs[kID] ? iMoment.dcDiffs[kID].subIndex : 0;
					if (!this_.masterContextsObject[kID]) {
						this_.masterContextsObject[kID] = {0: iContext};
						tMasterContext = iContext;
					} else {	// We've already stored a master
						tMasterContext = this_.masterContextsObject[kID][tSubIndex];
					}
					let tPatch = this_.diffPatcher.diff(tMasterContext, iContext);
					let tPatchSize = sizeof(tPatch),
						tContextSize = sizeof(iContext),
						tFraction = tPatchSize / tContextSize;
					console.log(`processDataContexts: Patch of size ${tPatchSize} and subIndex ${tSubIndex} is ${Number(tFraction.toFixed(5))} of context size of ${tContextSize}`);
					if(!tPatch)
						tPatch = {};
					if( tFraction <= kThreshold)
						iMoment.dcDiffs[kID] = { subIndex: tSubIndex, diff: tPatch};
					else {
						findOrCreateOptimalMaster( iContext, tSubIndex, tContextSize, tPatchSize);
					}
				});
				iNewCodapState.contexts = [];
			}
		}
	}

	/**
	 * Loop through all the master contexts, removing any no longer referenced by any of the moments
	 */
	removeUnusedMasterContexts() {
		let tMasterContextsObject = this.masterContextsObject;
		Object.keys(tMasterContextsObject).forEach((iID:string)=>{
			let tContextsObject:{[index:number]:object | null} = tMasterContextsObject[Number(iID)];
			Object.keys(tContextsObject).forEach((iSubIndex:string)=>{
				let tFoundRef = false;
				this.forEachMoment((iMoment:Moment)=>{
					let tDiffsObject = iMoment.dcDiffs[Number(iID)];
					tFoundRef = tFoundRef || tDiffsObject.subIndex === Number(iSubIndex);
				});
				if( !tFoundRef) {
					// @ts-ignore
					tContextsObject[iSubIndex] = null;
				}
			})
		});
	}

	createStorage() {
		let tMomentArray: {}[] = [],
			tCurrMomentIndex = 0;
		this.forEachMoment((iMoment:Moment, iIndex:number) => {
			if (iMoment === this.currentMoment)
				tCurrMomentIndex = iIndex;
			tMomentArray.push(iMoment.createStorage());
		});
		return {
			masterContexts: this.masterContextsObject,
			moments: tMomentArray,
			nextMomentID: this.nextMomentID,
			currentMomentIndex: tCurrMomentIndex,
		}
	}

	restoreFromStorage(iStorage: any) {
		let this_ = this,
			tCurrMoment: Moment | null = null;
		this.startingMoment = null;
		this.currentMoment = null;
		if (iStorage) {
			this.masterContextsObject = iStorage.masterContexts || {};
			this.nextMomentID = iStorage.nextMomentID;
		}

		if (!(iStorage && iStorage.moments))
			return;
		iStorage.moments.forEach((iMomentStorage: any, iIndex: number) => {
			let tMoment = new Moment(iIndex, iIndex + 1);
			tMoment.restoreFromStorage(iMomentStorage);
			if (!this_.startingMoment) {
				this_.startingMoment = tMoment;
			} else {
				if (tCurrMoment)
					tCurrMoment.next = tMoment;
				tMoment.prev = tCurrMoment;
			}
			tCurrMoment = tMoment;
			if (iStorage.currentMomentIndex === iIndex)
				this_.setCurrentMoment(tMoment);
			this_.processDataContexts(tMoment, tMoment.codapState);
		})
	}

	/**
	 * Utility to update the given moment with the given state.
	 *
	 * @param iMoment
	 * @param iState	a fresh new state from CODAP. We must deal with any contexts it has
	 * @param preserveMomentInfo    should the info in the MomentModel (title and narrative)
	 *                              be stored in the codapState as part of the text component?
	 *
	 */
	public matchMomentToCODAPState(iMoment: Moment | null, iState: StateObject, preserveMomentInfo: boolean) {

		if (iMoment instanceof Moment) {
			// console.log(`Setting [${iMoment.title}] to match a state`);
			this.processDataContexts(iMoment, iState);
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

	/**
	 * Call iFunc for each moment
	 * @param iFunc
	 */
	forEachMoment( iFunc:Function) {
		let tCurrMoment = this.startingMoment,
				tIndex = 0;
		while( tCurrMoment) {
			iFunc(tCurrMoment, tIndex);
			tCurrMoment = tCurrMoment.next;
			tIndex++;
		}
	}

	length() {
		let tCount = 0;
		this.forEachMoment(()=>{
			tCount++;
		})
		return tCount;
	}

	getMomentByID( iID:number):Moment | null {
		let tMoment = null;
		this.forEachMoment( (iMoment:Moment) => {
			if( iMoment.ID === iID)
				tMoment = iMoment;
		})
		return tMoment;
	}

	renumberMoments() {
		this.forEachMoment((iMoment:Moment, iIndex:number)=>{
			iMoment.momentNumber = iIndex + 1;	// 1-based
		})
	}

	getLastMoment():Moment | null {
		let tLastMoment = this.startingMoment;
		while( tLastMoment && tLastMoment.next)
			tLastMoment = tLastMoment.next;
		return tLastMoment;
	}

	/**
	 * Return the Moment corresponding to the given ID.
	 * @param iID
	 */
	
	momentByID(iID: number) {
		let tFoundMoment:Moment | null = null;
		this.forEachMoment((iMoment:Moment) => {
			if( iMoment.ID === iID)
				tFoundMoment = iMoment;
		});
		return tFoundMoment;
	}

	setCurrentMoment( iMoment:Moment | null) {
		if(iMoment !== this.currentMoment) {
			this.setMomentIsActive( this.currentMoment, false);
			if( this.currentMoment)
				this.currentMoment.setIsChanged( false);
			this.currentMoment = iMoment;
			this.setMomentIsActive( this.currentMoment, true);
		}
	}

	setMomentIsActive( iMoment:Moment | null, isActive:boolean) {
		if( iMoment)
			iMoment.setIsActive(isActive);
	}

	/**
	 * Remove the given moment from the prev-next linked list
	 * If the argument is null, nothing happens.
	 *
	 * @param iMoment
	 */
	removeMoment(iMoment: Moment | null) {
		if (iMoment) {
			const predecessor = iMoment.prev;
			const successor = iMoment.next;

			if (predecessor) {
				predecessor.next = successor;    //  correct even if doomed is last in line
				if( this.currentMoment === iMoment)
					this.setCurrentMoment( predecessor);
			} else {    //  no predecessor; the doomed one is the first
				this.startingMoment = successor;   //  will be null if the list is now empty
				if( this.currentMoment === iMoment)
					this.setCurrentMoment( successor); // do the next one if we killed off the first
			}

			if (successor) {
				successor.prev = predecessor;
			}
			// Just to be safe
			iMoment.next = null;
			iMoment.prev = null;
		}
		this.renumberMoments();
		this.removeUnusedMasterContexts();
	}

	deleteCurrentMoment() {
		this.removeMoment(this.currentMoment);
		this.setMomentIsActive( this.currentMoment, true);
	}

	duplicateCurrentMoment() {
		let tNewMoment = this.makeNewMomentUsingCodapState({contexts: null});
		tNewMoment.setIsNew(true);
	}

	markCurrentMomentAsChanged( iChanged:boolean) {
		if( this.currentMoment)
			this.currentMoment.setIsChanged( iChanged);
	}

	/**
	 * Move momentToMove to a new position in the list after insertAfterMoment
	 * @param momentToMove
	 * @param insertAfterMoment
	 */
	moveMomentToPositionAfter( momentToMove:Moment | null, insertAfterMoment:Moment | null) {
		if(!momentToMove || momentToMove === insertAfterMoment)
			return;
		this.removeMoment(momentToMove);
		this.insertMomentAfterMoment(momentToMove, insertAfterMoment);
	}

	/**
	 * Alter the moments list, inserting the given moment after the given moment
	 * (if it's going to the beginning, the given moment will be null)
	 * @param momentToInsert    moment to insert, assumed not to currently be in list
	 * @param insertAfterMoment  moment after which to insert it.
	 */
	insertMomentAfterMoment(momentToInsert: Moment, insertAfterMoment: Moment | null) {
		let subsequentMoment;

		if (insertAfterMoment) {
			subsequentMoment = insertAfterMoment.next;
			momentToInsert.prev = insertAfterMoment;
			momentToInsert.next = subsequentMoment; //  null if at the end
			insertAfterMoment.next = momentToInsert;
		} else {
			//   there are no moments in the list, e.g., at initialization
			//  or we're moving this moment to the beginning of the list, so
			//  insertAfterMoment is null.
			momentToInsert.next = this.startingMoment;  //  which is null if the list is empty
			this.startingMoment = momentToInsert;
			momentToInsert.prev = null;
			subsequentMoment = momentToInsert.next;
		}
		if (subsequentMoment) {
			subsequentMoment.prev = momentToInsert;
		}
		this.renumberMoments();
	}

	/**
	 * Create a moment, given a CODAP state.
	 * Makes it the currentMoment.
	 * return a Moment based on that state.
	 *
	 * @param iCodapState
	 */
	makeNewMomentUsingCodapState(iCodapState: StateObject): Moment {
		let tNewMoment: Moment= new Moment(this.nextMomentID++, 0, 'new');
		tNewMoment.setCodapState(iCodapState);

		this.insertMomentAfterMoment(tNewMoment, this.currentMoment);

		tNewMoment.title = (tNewMoment.ID === 0) ? "start ... comienzo" : "moment title/título";
		tNewMoment.narrative = tNewMoment.ID ? this.kInitialJSONText : this.kInitialJSONText_start;
		this.setCurrentMoment( tNewMoment);
		this.renumberMoments();
		return tNewMoment;
	}

	/**
	 * Set the narrative for the current index to the given text
	 * which was captured by the plugin from the text object, in response
	 * to an edit event.
	 *
	 * @param iString
	 */
	setNewNarrative(iString: string): void {
		if (this.currentMoment)
			this.currentMoment.setNarrative(iString);
	}

	/**
	 * Sets the title of the current moment
	 * @param iTitle
	 */
	setNewTitle(iTitle: string): void {
		if (this.currentMoment)
			this.currentMoment.setTitle(iTitle);
	}

	getMomentSummary(): string {
		let out = `\n`;
		this.forEachMoment((iMoment:Moment) => {
			out += `m ${iMoment.ID} `
				+ ((iMoment === this.currentMoment) ? "*" : " ")
				+ `[${iMoment.title}]`
				+ "\n";
		})
		return out;
	}
	
}