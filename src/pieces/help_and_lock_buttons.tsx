/**
 * This is a button in the upper right. When clicked the user gets more info about Story Builder.
 **/
import React from "react";

export function HelpButton() {

	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<a href='https://codap.concord.org/~bfinzer/help_site/help_site.html' rel="noreferrer" target='_blank'>
			<img className= 'SB-help-default' alt='get help'
					 title='Get some help about how to use Story Builder'
					 /></a>
		</div>
	)
}

export function LockButton(props: { isLocked: boolean, clickCallback: any }) {
	const state = props.isLocked ? 'lock' : 'unlock',
				className = `SB-${state}-default`,
				title = props.isLocked ? `Currently locked. Moments will not change. Click to unlock.` :
				`Currently unlocked. Click to prevent changes to moments.`;
	return (
		<div className='SB-button'
				 style={{right: 0} }>
			<img className={className} alt={state}
					 onClick={props.clickCallback}
					 title={title}
					 />
		</div>
	)
}