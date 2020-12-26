import React, {Component} from "react";
import {Moment} from "../models/moment";
import {ControlArea} from "./control_area";
import {TitleEditor} from "./title_editor";

interface MomentProps {
	momentsAreLocked: boolean,
	myMoment: Moment,
	onClickCallback: any,
	onTitleKeydownCallback: any,
	onTitleBlurCallback: any,
	onDeleteCallback: any,
	onDuplicateCallback: any,
	onSaveCallback: any,
	onRevertCallback: any,
	onDragOverCallback: any
}

interface MomentState { count: number, editIsInProgress: boolean }

/**
 * Objects of this class are responsible for displaying a Moment with which the user can interact.
 **/

export class MomentComponent extends Component<MomentProps, MomentState> {

	private container: any;
	private textArea: any;

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
		this.handleDragOver = this.handleDragOver.bind(this);
	}

	componentDidUpdate(prevProps: Readonly<MomentProps>,
										 prevState: Readonly<MomentState>,
										 prevLeftEdge?: any) {
		if(prevLeftEdge !== null) {
			const kDeltaT = 500;
			let tContainer = this.container.current,
					tNewLeftEdge = tContainer.getBoundingClientRect().x;
			if( prevLeftEdge !== tNewLeftEdge) {
				const tDelta = prevLeftEdge - tNewLeftEdge;
				tContainer.setAttribute('style',
					`transform: translateX(${tDelta}px);
				`);
				setTimeout( ()=>{
					tContainer.setAttribute('style',
						`transition: transform ${kDeltaT}ms;
					transform: none;
				`);
				}, 10);
				setTimeout( ()=>{
					tContainer.setAttribute('style',
						`transform: null;
				`);
				}, kDeltaT + 10);
			}
		}
	}

	getSnapshotBeforeUpdate(prevProps: Readonly<MomentProps>, prevState: Readonly<MomentState>): any | null {
		let tLeftEdge:any | null;
		if (this.container) {
			tLeftEdge = this.container.current.getBoundingClientRect().x;
		}
		return tLeftEdge;
	}

	componentDidMount() {
		if (this.props.myMoment.isNew()) {
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

	handleDelete(e: any) {
		this.props.onDeleteCallback();
		e.stopPropagation();
	}

	handleClick() {
		this.props.onClickCallback(this.props.myMoment);
	}

	handleFocus() {
		if (this.textArea.current)
			this.textArea.current.select();
	}

	handleTitleEditBlur(iTitle: string) {
		this.props.onTitleBlurCallback(this.props.myMoment, iTitle);
		this.setState({editIsInProgress: false});
	}

	handleKeyDown(e: any) {
		let handled = true;
		switch (e.keyCode) {
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
		this.setState({editIsInProgress: true});
	}

	handleDragStart(e: any) {
		e.dataTransfer.setData('text/plain', this.props.myMoment.ID);
	}

	handleDragOver(e: any) {
		let tMouseX = e.clientX,
				tRect = e.currentTarget.getBoundingClientRect(),
				tleft = tRect.left,
				tMiddle = tleft + tRect.width / 2,
				tSide = tMouseX < tMiddle ? 'before' : 'after',
				tOffset = tSide === 'before' ?
					(this.props.myMoment.momentNumber === 1 ? -5 : -10) : 5,
				tIndicatorX = tMouseX < tMiddle ? tleft + tOffset : tleft + tRect.width + tOffset;
		this.props.onDragOverCallback( this.props.myMoment, tIndicatorX, tSide);
	}

	public render() {
		let tIsLocked = this.props.momentsAreLocked,
			tIsActive = this.props.myMoment.isActive(),
			tIsChanged = this.props.myMoment.isChanged(),
			tIsNew = this.props.myMoment.isNew(),
			tDeleteButton = tIsActive && !tIsLocked ?
				(<div className='SB-delete-area'>
						<img className={'SB-button SB-delete-default'} alt='Delete this moment'
								 onClick={this.handleDelete}
								 title="Delete this moment"/>
					</div>
				) : null,
			tControlArea = tIsActive && !tIsLocked ? <ControlArea
				myMoment={this.props.myMoment}
				onDuplicateCallback={this.props.onDuplicateCallback}
				onSaveCallback={this.props.onSaveCallback}
				onRevertCallback={this.props.onRevertCallback}/> : null,
			tMomentClassName = `SB-moment ${tIsActive ? 'active' : ''}`,
			tMomentContainerName = `SB-moment-container ${tIsActive ? 'active' : ' '}${tIsNew ? ' start' : ''}`,
			tTitleArea = (
				<TitleEditor myMoment={this.props.myMoment}
										 handleBlurCallback={this.handleTitleEditBlur}
										 shouldSelectAll={tIsNew}
										 canEdit={!tIsLocked}>
				</TitleEditor>);

		return (
			<div
				className={tMomentContainerName}
				ref={this.container}
				onDragOver={this.handleDragOver}
			>
				<div className={tMomentClassName + (tIsChanged && !this.props.momentsAreLocked ? ' changed' : '')}
						 onClick={this.handleClick}
						 draggable={!this.props.momentsAreLocked}
						 onDragStartCapture={this.handleDragStart}
				>
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
