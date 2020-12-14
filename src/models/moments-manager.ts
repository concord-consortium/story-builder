/**
 * The MomentManager handles creation, save, restore, etc for moments, but NOT display.
 * 	(Used to be Timeline)
 **/
import {Moment} from "./moment";

export class MomentsManager {
	public currentMoment: Moment | null = null;
	public dstMoment: Moment | null = null;
	public srcMoment: Moment | null = null;
	public startingMoment: Moment | null = null;
	private nextMomentID: number = 0;
	private momentBeingDragged: Moment | null = null;
	private kInitialJSONText = `{"object":"value","document":{"children":[{"type":"paragraph","children":[{"text":"What did you do? Why did you do it?"}]},{"type":"paragraph","children":[{"text":"¿Qué hizo? ¿Por qué?"}]}],"objTypes":{"paragraph":"block"}}}`;
	private kInitialJSONText_start = `{"object":"value","document":{"children":[{"type":"paragraph","children":[{"text":"This is the beginning of your data story."}]},{"type":"paragraph","children":[{"text":"Esto es el comienzo de su cuento de datos."}]}],"objTypes":{"paragraph":"block"}}}`;

	constructor() {
	}

	getCurrentMomentTitle(): string {
		return (this.currentMoment) ? this.currentMoment.title : "";
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
			this.nextMomentID = iStorage.nextMomentID;
		}

		if (!(iStorage && iStorage.moments))
			return;
		iStorage.moments.forEach((iMomentStorage: any, iIndex: number) => {
			let tMoment = new Moment(iIndex, iIndex);
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
		})
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

	renumberMoments() {
		this.forEachMoment((iMoment:Moment, iIndex:number)=>{
			iMoment.momentNumber = iIndex + 1;	// 1-based
		})
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
	deleteMoment(iMoment: Moment | null) {
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
	}

	deleteCurrentMoment() {
		this.deleteMoment(this.currentMoment);
		this.setMomentIsActive( this.currentMoment, true);
	}

	duplicateCurrentMoment() {
		let tNewMoment = this.makeNewMomentUsingCodapState({});
		tNewMoment.setIsNew(true);
	}

	/**
	 * Alter the moments list, inserting the given moment after the given moment
	 * (if it's going to the beginning, the given moment will be null)
	 * @param newMoment    moment to insert
	 * @param previousMoment  moment after which to insert it.
	 */
	insertMomentAfterMoment(newMoment: Moment, previousMoment: Moment | null):Moment {
		let subsequentMoment;

		if (previousMoment) {
			subsequentMoment = previousMoment.next;
			newMoment.prev = previousMoment;
			newMoment.next = subsequentMoment; //  null if at the end
			previousMoment.next = newMoment;
		} else {
			//   there are no moments in the list, e.g., at initialization
			//  or we're moving this moment to the beginning of the list, so
			//  previousMoment is null.
			newMoment.next = this.startingMoment;  //  which is null if the list is empty
			this.startingMoment = newMoment;
			newMoment.prev = null;
			subsequentMoment = newMoment.next;
		}
		if (subsequentMoment) {
			subsequentMoment.prev = newMoment;
		}
		this.renumberMoments();
		return newMoment;
	}

	/**
	 * Create a moment, given a CODAP state.
	 * Makes it the currentMoment.
	 * return a Moment based on that state.
	 *
	 * @param iCodapState
	 */
	makeNewMomentUsingCodapState(iCodapState: object): Moment {
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