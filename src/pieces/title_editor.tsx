/**
 * This component displays the three control buttons that appear below the active moment.
 */

import React, {Component} from "react";
import {Moment} from "../models/moment";

export class TitleEditor extends Component<{
	myMoment: Moment,
	setTextAreaCallback:any,
	handleBlurCallback:any,
	shouldSelectAll:boolean,
	canEdit:boolean
},
	any> {
	private textArea:any;
	private savedText:string = '';

	constructor(props:any) {
		super(props);
		this.textArea = React.createRef();
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleFocus = this.handleFocus.bind(this);
	}

	componentDidMount() {
		this.savedText = this.props.myMoment.title;
		this.textArea.current.value = this.savedText;
		if( this.props.shouldSelectAll) {
			this.textArea.current.select();
		}
	}

	componentDidUpdate() {
		this.componentDidMount();
	}

	handleFocus() {
		// Call the following so we can be sure our owner component has the correct ref and knows that an edit has started
		this.props.setTextAreaCallback( this.textArea);
	}

	handleKeyDown(e:any) {
		let handled = true;
		switch(e.keyCode) {
			case 27:    //  cancel
				this.textArea.current.value = this.savedText;
				this.textArea.current.blur();
				break;
			case 13:    //  enter/return
				this.textArea.current.blur();
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
				disabled={!this.props.myMoment.isActive() || !this.props.canEdit}
				className={"SB-moment-title SB-title-editor"}
				onFocus={this.handleFocus}
				onBlur={(e:any)=> {
					this.props.handleBlurCallback(e.target.value);
				}}
				onKeyDown={this.handleKeyDown}
				defaultValue={this.props.myMoment.title}
			>
			</textarea>
		);
	}
}