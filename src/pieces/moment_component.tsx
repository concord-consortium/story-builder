import React, {Component} from "react";
import {Moment} from "../models/moment";
import {ControlArea} from "./control_area";
import {MomentState} from "../utilities/sb_types";

/**
 * Objects of this class are responsible for displaying a Moment with which the user can interact.
 **/

export class MomentComponent extends Component<{myMoment:Moment, onClickCallback:any}, {mode:string, momentState:MomentState}> {

	constructor(props: any) {
		super(props);
		this.state = {mode: props.mode || 'empty',
									momentState: {
											revert: 'default',
											save: 'default',
											new: 'default'
										}
		};
	}

	handleClick(e:any) {
		this.props.onClickCallback(this.props.myMoment);
	}

	public render() {
		let tControlArea = this.props.myMoment.isActive() ?
			<ControlArea momentState={this.state.momentState}/> : null;

		return (
			<div className="SB-moment-container">
				<div className="SB-moment"
						 onClick={this.handleClick}>
					<div className='SB-moment-number'>
						{this.props.myMoment.ID}
					</div>
					<p className='SB-moment-title'>
						{this.props.myMoment.title}
					</p>
				</div>
				{tControlArea}
			</div>
		);
	}

}
