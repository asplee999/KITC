
const utils = require('./utils');
const fs = require('fs');

let errorCauses = false;

async function getListHouse(){
	let resdata = await utils.requestData({
		op: "list_house",
		pagenum: 1,
		pagesize: 100
	});
	if ( Array.isArray(resdata.result) ) {
		return resdata.result;
	}
	console.log("Error: " + resdata.result);
	errorCauses = errorCauses || true;
	return false;
}

async function getListDevices(ieee){
	let resdata = await utils.requestData({
		op: "list_device",
		house_ieee: ieee,
		pagenum: 1,
		pagesize: 100
	});	
	if ( Array.isArray(resdata.result) ) {
		return resdata.result;
	}
	console.log("Error: " + resdata.result);
	errorCauses = errorCauses || true;
	return false;
}

async function findDevicesFromKey(ieee){
	await utils.sleep(5000);
	let devResults = await getListDevices(ieee);
	if ( devResults ) {
		return devResults.map(dev => dev.id).filter(id => ieee != id);
	}
	return false;
}

async function mainProcess(){
	let finalMap = {};
	let houses = await getListHouse();
	if ( houses ) {
		let keys = houses.map(house => house.houseIeee);

		await async function(){
			let ieee;
			while ( ieee = keys.pop() ){
				let devcesRes = await findDevicesFromKey(ieee);
				if ( !devcesRes ) return;
				finalMap[ieee] = devcesRes;
			}
		}();
	}
	if ( errorCauses ) {
		console.log("Error Causes");
	} else {
		fs.writeFile("./devices.json", JSON.stringify(finalMap, null, 4), (err) => {
			if (err) {
				console.error(err);
				return;
			};
			console.log("devices.json has been saved");
		});
	}
}

mainProcess();
