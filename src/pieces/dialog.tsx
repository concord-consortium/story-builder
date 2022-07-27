/**
 * This component displays a dialog box with two or three buttons
 */

import React, {Component} from "react";
import tr from "../utilities/translate";

export class Dialog extends Component<{
	dialogState: {
		heading: string,
		explanation: string,
		labeledCallbacks: {
			label: string,
			callback: any
		}[]
	}
	checkboxCallback: (newSetting?:boolean)=>boolean
}, { isAutoSave:boolean }> {

	constructor(props:any) {
		super(props);
		this.state = { isAutoSave: props.checkboxCallback()}
	}


	render() {
		let this_ = this,
			numLabels = this.props.dialogState.labeledCallbacks.length;

		function buttons() {
			return this_.props.dialogState.labeledCallbacks.map((iLabeledCallback, iIndex) => {
				return (<button key={`button-${iIndex}`}
												className='SB-dialog-button'
												autoFocus={iIndex === numLabels - 1}
												onClick={() => {
													iLabeledCallback.callback(this_.props.dialogState);
												}}>
					{iLabeledCallback.label}</button>);
			});
		}

		function optOutCheckbox() {
			return (
				<label>
					<input type="checkbox"
					checked={this_.props.checkboxCallback()}
					onChange={(e)=> {
						const isChecked = e.target.checked
						this_.props.checkboxCallback(isChecked)
						this_.setState({isAutoSave: isChecked})
					}}/>
					{tr("dg.plugin.storyBuilder.dialog.optOutCheckbox")}
				</label>
			)
		}

		let tButtons = buttons();
		return (
			<div className='SB-dialog'
			>
				<p><strong>{this.props.dialogState.heading}</strong></p>
				<p>{this.props.dialogState.explanation}</p>
				<div className={'SB-button-container'}>
					{tButtons}
				</div>
				{optOutCheckbox()}
			</div>
		);
	}
}
