/**
 * A Moment is the model that contains information that can be saved and restored.
 **/
import {Delta} from "jsondiffpatch";

export interface StateObject {contexts:{}[] | null}
export interface DiffsObject {subIndex:number, diff:Delta}	// index is sub-ID of master data context

export class Moment {
	public ID: number = 0;
	public momentNumber: number = 0;
	public prev: Moment | null = null;
	public next: Moment | null = null;
	public dcDiffs: {[index:number]: DiffsObject}; // index is dataContext ID
	public codapState: StateObject = {contexts: null};
	public title: string = "";
	public created: Date = new Date();
	public modified: Date = new Date();
	public narrative: any = "";
	private isNewMoment: boolean = false;
	private myState = 'inactive';	// 'inactive' | 'active
	private amIChanged = false;
	private forceUpdateCallback: (() => void) | null = null;

	constructor(iID: number, iMomentNumber: number, iState?: string) {
		this.ID = iID;
		this.momentNumber = iMomentNumber;
		this.dcDiffs = {};
		if (iState)
			this.myState = iState;
		if( iState === 'new')
			this.isNewMoment = true;
	}

	setForceUpdateCallback(iCallback: () => void) {
		this.forceUpdateCallback = iCallback;
	}

	callForceUpdate() {
		if (this.forceUpdateCallback) {
			this.forceUpdateCallback();
		}
	}

	createStorage() {
		return {
			ID: this.ID,
			codapState: this.codapState,
			dcDiffs: this.dcDiffs,
			title: this.title,
			amIChanged: this.amIChanged,
			created: this.created,
			narrative: this.narrative
		}
	}

	restoreFromStorage(iStorage: any) {
		this.ID = iStorage.ID;
		this.codapState = iStorage.codapState;
		this.dcDiffs = iStorage.dcDiffs || {};
		this.title = iStorage.title;
		this.amIChanged = iStorage.amIChanged;
		this.created = new Date(iStorage.created);
		this.narrative = iStorage.narrative;

	}

	isNew(): boolean {
		return this.isNewMoment;
	}

	setIsNew(iIsNew: boolean) {
		this.isNewMoment = iIsNew;
	}

	isActive(): boolean {
		return this.myState === 'active';
	}

	setIsActive(iActive: boolean) {
		this.myState = iActive ? 'active' : 'inactive';
		if (!iActive) {
			this.setIsChanged(false);
		}
	}

	isChanged() {
		return this.amIChanged;
	}

	setIsChanged(iIsChanged: boolean) {
		if (iIsChanged !== this.amIChanged) {
			this.amIChanged = iIsChanged;
			this.callForceUpdate();
		}
	}

	toString(): string {
		return `ID: ${this.ID} title: [${this.title}] narrative: ${this.extractNarrative()}`;
	}

	setCodapState(iCodapState: StateObject) {
		const tContexts = iCodapState.contexts
		iCodapState.contexts = null
		this.codapState = JSON.parse(JSON.stringify(iCodapState))
		iCodapState.contexts = tContexts
	}

	setTitle(iTitle: string) {
		if (iTitle !== this.title) {
			this.title = iTitle;
			this.callForceUpdate();
		}
	}

	setNarrative(iText: string) {
		this.narrative = iText;
	}

	extractNarrative(): string {
		if (this.narrative.document) {
			return this.narrative.document.children[0].children[0].text;
		} else {
			return "(txt) " + this.narrative;
		}
	}
}