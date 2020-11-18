/**
 * A Moment is the model that contains information that can be saved and restored.
 **/

export class Moment {
	public ID: number = 0;
	public prev: Moment | null = null;
	public next: Moment | null = null;
	private myState = 'inactive';
	public codapState: object = {};
	public title: string = "This is a nice new moment with lots of text";
	public created: Date = new Date();
	public modified: Date = new Date();
	public narrative: any = "";

	constructor( iID:number, iState?:string) {
		this.ID = iID;
		if( iState)
			this.myState = iState;
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

	isActive():boolean {
		return this.myState === 'active';
	}

	toString(): string {
		return `ID: ${this.ID} title: [${this.title}] narrative: ${this.extractNarrative()}`;
	}

	setCodapState(iCodapState: object) {
		this.codapState = iCodapState;
	}

	setTitle(iTitle: string) {
		this.title = iTitle;
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