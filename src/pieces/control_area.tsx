/**
 * This component displays the three control buttons that appear below the active moment.
 */

import React, {Component} from "react";
import {MomentState} from "../utilities/sb_types";

export class ControlArea extends Component<{ momentState:MomentState }, any> {

	constructor(props:any) {
		super(props);
		this.handleRevert = this.handleRevert.bind(this);
		this.handleSave = this.handleSave.bind(this);
		this.handleDuplicate = this.handleDuplicate.bind(this);
	}

	handleRevert() {

	}

	handleSave() {

	}

	handleDuplicate() {

	}

	render() {
		return (
			<div className='SB-control-area'>
				<img className={`SB-revert-${this.props.momentState.revert}`} alt='Discard changes'
						 onClick={() => this.handleRevert()}/>
				<img className={`SB-save-${this.props.momentState.revert}`} alt='Save'
						 onClick={() => this.handleSave()}/>
				<img className={`SB-duplicate-${this.props.momentState.revert}`} alt='Make a new moment'
						 onClick={() => this.handleDuplicate()}/>
			</div>
		);
	}
}