/**
 * This component displays the three control buttons that appear below the active moment.
 */

import React, {Component} from "react";
import {Moment} from "../models/moment";
import tr from  '../utilities/translate';

export class ControlArea extends Component<{
	myMoment:Moment,
	onDuplicateCallback:any,
	onSaveCallback:any,
	onRevertCallback:any
}, any> {

	constructor(props:any) {
		super(props);
		this.handleRevert = this.handleRevert.bind(this);
	}

	handleRevert() {
		this.props.onRevertCallback();
	}

	render() {
		const kDefOrDis = this.props.myMoment.isChanged() ? 'default' : 'disabled';
		return (
			<div className='SB-control-area'>
				<img className={`SB-revert-${kDefOrDis}`}
					 alt={tr("DG.plugin.StoryBuilder.controlArea.discardAlt")}
					 onClick={this.props.onRevertCallback}
					 title={tr("DG.plugin.StoryBuilder.controlArea.discardTooltip")}/>
				<img className={`SB-save-${kDefOrDis}`}
					 alt={tr("DG.plugin.StoryBuilder.controlArea.saveAlt")}
					 onClick={this.props.onSaveCallback}
					 title={tr("DG.plugin.StoryBuilder.controlArea.saveTooltip")}/>
				<img className={`SB-duplicate-default`}
					 alt={tr("DG.plugin.StoryBuilder.controlArea.newAlt")}
					 onClick={() => this.props.onDuplicateCallback()}
					 title={tr("DG.plugin.StoryBuilder.controlArea.newTooltip")}/>
			</div>
		);
	}
}
