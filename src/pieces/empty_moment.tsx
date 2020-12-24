/**
 * An empty moment is a placeholder for when user deletes all normal moments. Clicking creates a new normal moment.
 **/
import React from "react";

export function EmptyMoment(props:any) {

	return (
		<div className='SB-empty-moment'
				 title='Click to make a new moment'
				 onClick={props.onClick}
				 >
			<img className= 'SB-add-default' alt='make new moment'/>
		</div>
	)
}