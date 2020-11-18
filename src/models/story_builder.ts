import {StoryArea} from "./story_area";
import {initializePlugin} from "../lib/codap-helper";
import codapInterface from "../lib/CodapInterface";

export class StoryBuilder {

	public storyArea:StoryArea = new StoryArea();

	constructor() {
		this.restorePluginState = this.restorePluginState.bind(this);
	}

	async initialize() {
		const kPluginName = "Story Builder";
		const kVersion = "0.6.1";
		const kInitialDimensions = {
			width: 800,
			height: 130
		}

		await initializePlugin(kPluginName, kVersion, kInitialDimensions, this.restorePluginState)
			.catch(() => {
				console.log(`••• problem initializing the plugin`)
			});

		const getComponentListMessage = {
			'action': 'get',
			'resource': 'componentList'
		};

		try {
			let tResult: any = await codapInterface.sendRequest(getComponentListMessage);
			const listResult = tResult.values;
			let tPluginID = listResult.find((iResult: any) => {
				return iResult.title === kPluginName;
			}).id;
			const positionValues = "{left: 8, top: 222}";       //  'bottom'
			const adjustPluginMessage = {
				'action': 'update',
				'resource': 'component[' + tPluginID + ']',
				'values': {'position': positionValues, 'cannotClose': true,
					'isResizable': { width: true, height: false }}
			};
			await codapInterface.sendRequest(adjustPluginMessage);
		} catch (err) {
			console.log('error trying to get id: ' + err);
		}
	}

	restorePluginState(iState: any) {
		this.storyArea.restorePluginState( iState);
	}

}