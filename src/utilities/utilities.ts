import codapInterface from "../lib/CodapInterface";

export const kNarrativeTextBoxName = "WDS-narrative-box";

export function putTextComponentInfoIntoCodapState(info: any, iState: any): void {
	const theComponents = iState.components;
	let theComponentStorage: any = null;

	if (theComponents.length) {     //  works even if there is only one component; why not, after all?
		theComponents.forEach((comp: any) => {
			if (comp.type === "DG.TextView" && comp.componentStorage.name === kNarrativeTextBoxName) {
				theComponentStorage = comp.componentStorage;
				if (theComponentStorage) {
					theComponentStorage.text = info.narrative;
					theComponentStorage.title = info.title;
				}
			}
		});

	} else {
		alert(`problem: theComponents has length ${theComponents.length}. We expect at least one!`);
	}

}

export function getNarrativeBoxInfoFromCodapState(iState: any): object {
	const theComponents = iState.components;
	let theComponentStorage: any = null;

	if (theComponents.length > 1) {
		theComponents.forEach((comp: any) => {
			if (comp.type === "DG.TextView" && comp.componentStorage.name === kNarrativeTextBoxName) {
				theComponentStorage = comp.componentStorage;
			}
		});

		if (theComponentStorage) {
			return {
				narrative: theComponentStorage.text,
				title: theComponentStorage.title,
			}
		} else {
			alert(`problem: theComponentStorage may be null. Perhaps the text component is missing or undetectable...`);

		}
	} else {
		alert(`problem: theComponents has length ${theComponents.length}. We expect at least two!`);
	}

	return {
		narrative: "foo",
		title: "foo",
	}
}


/**
 * Determine if we need a fresh narrative text box.
 * Returns the ID of the text box, 0 if not found.
 */
export async function needNarrativeTextBox(): Promise<number> {
	let need: number = -1;

	const theMessage = {action: "get", resource: "componentList"};
	await codapInterface.sendRequest(theMessage)
		.catch((e) => {
			console.log(`••• problem finding out about the component list——`, e);
		})
		.then((iResult:any)=> {
			if( iResult && iResult.success) {
				console.log('success');
				iResult.values.forEach((c: any) => {
					if (c.name === kNarrativeTextBoxName) {
						if (c.type === 'text') {
							need = c.id as number;
						}
					}
				})
				return need;
			}
		});
	return need;
}

export async function setBusyIndicator(setIt:boolean) {
	const request = setIt ? 'indicateBusy' : 'indicateIdle'
	await codapInterface.sendRequest({
		"action": "notify",
		"resource": "interactiveFrame",
		"values": {
			"request": request,
			"cursorMode": true
		}
	})
}