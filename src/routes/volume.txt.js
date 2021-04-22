import fs from 'fs'
import path from 'path'


export const post = async (req) => {

	console.log(req, 'VOLUME!!', req.body)
	return {
		status: 200,
		body: 'yoyoyoyoy'
	}
}

export const get = async (req) => {
	return {
		status: 200,
		body: await fs.readFileSync( 'static/volume.txt', {encoding:'utf8'} )
	}
}