/**
 * This component displays the three control buttons that appear below the active moment.
 */

import React, {Component} from "react";
import {Moment} from "../models/moment";

export class ControlArea extends Component<{
	myMoment:Moment,
	onDuplicateCallback:any
}, any> {

	constructor(props:any) {
		super(props);
		this.handleRevert = this.handleRevert.bind(this);
		this.handleSave = this.handleSave.bind(this);
	}

	handleRevert() {

	}

	handleSave() {

	}

	render() {
		const kDefOrDis = this.props.myMoment.isChanged ? 'default' : 'disabled';
		return (
			<div className='SB-control-area'>
				<img className={`SB-revert-${kDefOrDis}`} alt='Discard changes'
						 onClick={() => this.handleRevert()}
						 title="Discard changes to this moment"/>
				<img className={`SB-save-${kDefOrDis}`} alt='Save'
						 onClick={() => this.handleSave()}
						 title="Save this moment"/>
				<img className={`SB-duplicate-default`} alt='Make a new moment'
						 onClick={() => this.props.onDuplicateCallback()}
						 title="Add a new moment to the right"/>
			</div>
		);
	}
}