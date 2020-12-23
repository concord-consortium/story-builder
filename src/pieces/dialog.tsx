/**
 * This component displays a dialog box with two or three buttons
 */

import React, {Component} from "react";

export class Dialog extends Component<{dialogState:{
	heading: string,
	explanation: string,
	labeledCallbacks: {
		label:string,
		callback:any
	}[]
}}, any> {

	render() {
		let this_ = this,
				numLabels = this.props.dialogState.labeledCallbacks.length;

		function buttons() {
			return this_.props.dialogState.labeledCallbacks.map( (iLabeledCallback, iIndex)=>{
				return (<button key={`button-${iIndex}`}
												className='SB-dialog-button'
												autoFocus={iIndex === numLabels - 1}
									onClick={()=> {
										iLabeledCallback.callback(this_.props.dialogState);
									}}>
					{iLabeledCallback.label}</button>);
			});
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
			</div>
		);
	}
}