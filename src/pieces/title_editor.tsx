/**
 * This component displays the three control buttons that appear below the active moment.
 */

import React, {Component} from "react";
import {Moment} from "../models/moment";

export class TitleEditor extends Component<{
	myMoment: Moment,
	handleBlurCallback:any,
	shouldSelectAll:boolean
},
	any> {
	private textArea:any;

	constructor(props:any) {
		super(props);
		this.textArea = React.createRef();
		this.handleKeyDown = this.handleKeyDown.bind(this);
	}

	componentDidMount() {
		if( this.props.shouldSelectAll)
			this.textArea.current.select();
	}

	handleFocus() {

	}

	handleKeyDown(e:any) {
		let handled = true;
		switch(e.keyCode) {
			case 27:    //  cancel
				this.props.handleBlurCallback("");
				break;
			case 13:    //  enter/return
				this.props.handleBlurCallback(e.target.value);
				break;
			default:
				handled = false;
				break;
		}
		if (handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	render() {
		return (
			<textarea
				id={"currentMomentTitleEditBox"}
				ref={this.textArea}
				className={"SB-moment-title SB-title-editor"}
				onFocus={this.handleFocus}
				onBlur={(e:any)=> {
					this.props.handleBlurCallback(e.target.value);
				}}
				onKeyDown={this.handleKeyDown}
				defaultValue={this.props.myMoment.title}>
            </textarea>
		);
	}
}