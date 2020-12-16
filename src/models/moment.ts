/**
 * A Moment is the model that contains information that can be saved and restored.
 **/

export class Moment {
	public ID: number = 0;
	public momentNumber: number = 0;
	public prev: Moment | null = null;
	public next: Moment | null = null;
	public codapState: object = {};
	public title: string = "This is a nice new moment with lots of text";
	public created: Date = new Date();
	public modified: Date = new Date();
	public narrative: any = "";
	private isNewMoment:boolean = false;
	private myState = 'inactive';	// 'inactive' | 'active
	public isChanged = false;
	private forceUpdateCallback:(()=>void) | null = null;

	constructor( iID:number, iMomentNumber:number, iState?:string) {
		this.ID = iID;
		this.momentNumber = iMomentNumber;
		if( iState)
			this.myState = iState;
	}

	setForceUpdateCallback( iCallback:()=>void) {
		this.forceUpdateCallback = iCallback;
	}

	callForceUpdate() {
		if(this.forceUpdateCallback) {
			this.forceUpdateCallback();
		}
	}

	createStorage() {
		return {
			ID: this.ID,
			codapState: this.codapState,
			title: this.title,
			created: this.created,
			narrative: this.narrative
		}
	}

	restoreFromStorage(iStorage: any) {
		this.ID = iStorage.ID;
		this.codapState = iStorage.codapState;
		this.title = iStorage.title;
		this.created = new Date(iStorage.created);
		this.narrative = iStorage.narrative;

	}

	isNew():boolean {
		return this.isNewMoment;
	}

	setIsNew( iIsNew:boolean) {
		this.isNewMoment = iIsNew;
	}

	isActive():boolean {
		return this.myState === 'active';
	}

	setIsActive( iActive:boolean) {
		this.myState = iActive ? 'active' : 'inactive';
		if( !iActive) {
			this.isChanged = false;
		}
	}

	setIsChanged( iIsChanged:boolean) {
		if( iIsChanged !== this.isChanged) {
			this.isChanged = iIsChanged;
			this.callForceUpdate();
		}
	}

	toString(): string {
		return `ID: ${this.ID} title: [${this.title}] narrative: ${this.extractNarrative()}`;
	}

	setCodapState(iCodapState: object) {
		this.codapState = iCodapState;
	}

	setTitle(iTitle: string) {
		if( iTitle !== this.title) {
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