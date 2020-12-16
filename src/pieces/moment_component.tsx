import React, {Component} from "react";
import {Moment} from "../models/moment";
import {ControlArea} from "./control_area";
import {TitleEditor} from "./title_editor";

/**
 * Objects of this class are responsible for displaying a Moment with which the user can interact.
 **/

export class MomentComponent extends Component<{
	myMoment: Moment,
	isNew:boolean,
	onClickCallback:any,
	onTitleKeydownCallback:any,
	onTitleBlurCallback:any,
	onDeleteCallback: any,
	onDuplicateCallback: any,
	onSaveCallback:any
}, { count: number, editIsInProgress:boolean }> {

	private container:any;
	private textArea:any;

	constructor(props: any) {
		super(props);
		this.state = {count: 0, editIsInProgress: false};
		this.container = React.createRef();
		this.textArea = React.createRef();
		this.forceUpdateCallback = this.forceUpdateCallback.bind(this);
		props.myMoment.setForceUpdateCallback(this.forceUpdateCallback);
		this.handleClick = this.handleClick.bind(this);
		// this.handleClickCapture = this.handleClickCapture.bind(this);
		this.handleDelete = this.handleDelete.bind(this);
		this.handleTitleEditBlur = this.handleTitleEditBlur.bind(this);
		this.handleFocus = this.handleFocus.bind(this);
		this.handleTitleClick = this.handleTitleClick.bind(this);
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleDragStart = this.handleDragStart.bind(this);
		this.handleDrop = this.handleDrop.bind(this);
	}

	componentDidMount() {
		if( this.props.myMoment.isNew()) {
			let this_ = this;
			setTimeout(() => {
				this_.container.current.style.transform = 'none';
				this_.props.myMoment.setIsNew(false);
			}, 10);
			setTimeout(() => {
				this_.container.current.classList.remove('start');
				this_.container.current.style.transform = null;
			}, 510);
		}
	}

	forceUpdateCallback() {
		this.setState({count: this.state.count + 1});
	}

	handleDelete(e:any) {
		this.props.onDeleteCallback();
		e.stopPropagation();
	}

	handleClick() {
		this.props.onClickCallback(this.props.myMoment);
	}

/*
	handleClickCapture() {
		if( !this.props.myMoment.isActive()) {
			this.props.onClickCallback(this.props.myMoment);
			return true;
		}
		else return false;
	}
*/

	handleFocus() {
		if( this.textArea.current)
			this.textArea.current.select();
	}

	handleTitleEditBlur(iTitle:string) {
		this.props.onTitleBlurCallback(this.props.myMoment, iTitle);
		this.setState({editIsInProgress: false});
	}

	handleKeyDown(e:any) {
		let handled = true;
		switch(e.keyCode) {
			case 27:    //  cancel
				this.handleTitleEditBlur("");
				break;
			case 13:    //  enter/return
				this.handleTitleEditBlur(e.target.value);
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

	handleTitleClick() {
		this.setState( {editIsInProgress: true});
	}

	handleDragStart(e:any) {
		console.log('drag start');
	}

	handleDrop(e:any) {
		console.log('drag start');
	}

	public render() {
		let tIsActive = this.props.myMoment.isActive(),
			tIsChanged = this.props.myMoment.isChanged,
			tIsNew = this.props.isNew,
			tDeleteButton = tIsActive ?
				(<div className='SB-delete-area'>
						<img className={`SB-delete-default`} alt='Delete this moment'
								 onClick={this.handleDelete}
									title="Delete this moment"/>
					</div>
				) : null,
			tControlArea = tIsActive ? <ControlArea
				myMoment={this.props.myMoment}
				onDuplicateCallback = {this.props.onDuplicateCallback}
				onSaveCallback={this.props.onSaveCallback}/> : null,
			tMomentClassName = `SB-moment ${tIsActive ? 'active' : ''}`,
			tTitleArea = (
					<TitleEditor myMoment={ this.props.myMoment}
											 handleBlurCallback={ this.handleTitleEditBlur}
											 shouldSelectAll={tIsNew}>
					</TitleEditor>);

		return (
			<div
				className={`SB-moment-container${tIsNew ? ' start' : ''}`}
				ref={this.container}
				// onClickCapture={this.handleClickCapture}
			>
				<div className={tMomentClassName + (tIsChanged ? ' changed' : '')}
						 onClick={this.handleClick}
						 draggable
						 onDragStartCapture={this.handleDragStart}
						 onDropCapture={this.handleDrop}>
					<div className='SB-moment-number'>
						{this.props.myMoment.momentNumber}
					</div>
					{tDeleteButton}
					{tTitleArea}
				</div>
				{tControlArea}
			</div>
		);
	}

}
