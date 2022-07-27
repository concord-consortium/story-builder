/**
 * An empty moment is a placeholder for when user deletes all normal moments. Clicking creates a new normal moment.
 **/
import React from "react";
import tr from "../utilities/translate";

export function EmptyMoment(props:any) {

	return (
		<div className='SB-empty-moment'
				 title={tr("Click to make a new moment")}
				 onClick={props.onClick}
				 >
			<img className= 'SB-add-default' alt={tr("make new moment")}/>
		</div>
	)
}
