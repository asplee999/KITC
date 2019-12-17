const MongoClient = require('mongodb').MongoClient;
const mysql = require('mysql');

// about date time
const datetimeFormat = "YYYY-MM-DD HH:mm:ss";
const moment = require('moment');
const executeDatetime = moment().format(datetimeFormat);
const previousMins = 62;	// to ignore errors if voltage delay

// secrets
const secrets = require('./secrets');

// db connect config
const mysqlConf = secrets.mysql.connect;
const mongoConf = secrets.mongo;

// devices
const devices = require('./devices');

const utils = require('./utils');

const mysqlConnection = mysql.createConnection({
	host     : mysqlConf.host,
	user     : mysqlConf.user,
	password : mysqlConf.password,
	database : mysqlConf.database
});

const attrMaps = {
	temperature: "temperature",
	humidity: "humidity",
	battery_voltage: "voltage"
};

const tableCols = [
	{ name: "ieee", type: "string" },
	{ name: "device_id", type: "string" },
	{ name: "time", type: "string" },
	{ name: "temperature", type: "number" },
	{ name: "humidity", type: "number" },
	{ name: "voltage", type: "number" }
];

const getPropMapArrayObject = function(arr, keyname){
	let resMap = {};
	arr.forEach(item => {
		if ( !resMap[item[keyname]] ) resMap[item[keyname]] = [];
		resMap[item[keyname]].push(item);
	});
	return resMap;
};

const generateCollects = (ieee, map) => {
	return Object.keys(map).map( (dev) => {
		let tuple = map[dev];
		let valset = {};
		Object.keys(tuple).forEach( (attr) => {
			let tableCol = attrMaps[attr];
			let floatVal = parseFloat(tuple[attr].value);
			valset[tableCol] = isNaN(floatVal) ? null : floatVal;
		});

		valset["ieee"] = ieee;
		valset["device_id"] = dev;
		valset["time"] = executeDatetime;

		return valset;
	});
};

const generateSqlValues = (collects) => {
	let sqlValues = collects.map(tuple => {
		return "(" + tableCols.map(col => {
			let name = col.name,
				type = col.type,
				val = tuple[name];
			return typeof val == "undefined" ? "null" : (type == "string" ? ("'" + val + "'") : val );
		}).join(",") + ")";
	});
	
	return sqlValues;
};

async function mainProcess(){
	let lstDevs = Object.keys(devices);
	let totalCollects = [];
	let totalSqlValues = [];
	await async function(){
		let ieee;
		while ( ieee = lstDevs.pop() ){
			const devIds = devices[ieee];

			console.log("[Info][mainProcess] request data by ieee: " + ieee + ", devIds: " + devIds.join(','));

			let resdata = await utils.requestData({
				op: "list_attr",
				house_ieee: ieee,
				dev_ids: devIds,
				// attr: "battery_voltage",
				start_time: moment(executeDatetime).subtract(previousMins, 'm').format(datetimeFormat),
				end_time: executeDatetime,
				pagenum: 1,
				pagesize: 100
			});	

			console.log("[Info][mainProcess] request origin result: " + JSON.stringify(resdata));

			if (Array.isArray(resdata.result)) {
				let resMap = getPropMapArrayObject(resdata.result, 'dev_id');

				Object.keys(resMap).forEach(function(id){
					let attrRaws = getPropMapArrayObject(resMap[id], 'attr');
					let attrLast = {};
					Object.keys(attrRaws).forEach(function(attr){
						attrLast[attr] = (attrRaws[attr] || []).pop();
					});
					resMap[id] = attrLast;
				});

				let collects = generateCollects(ieee, resMap);
				let sqlValues = generateSqlValues(collects);
				
				if ( collects.length ) totalCollects = totalCollects.concat(collects);
				if ( sqlValues.length ) totalSqlValues = totalSqlValues.concat(sqlValues);
				
			} else console.log("[Error][mainProcess] server return: " + resdata.result);

			await utils.sleep(5000);
		}
	}();

	console.log("[Info][mainProcess] prepare insert: " + totalSqlValues.join(","));

	// mysql insert
	if ( totalSqlValues.length ) {
		let sqlCommand = "INSERT INTO " + secrets.mysql.table + " (" + tableCols.map(c => c.name).join(",") + ") VALUES " + totalSqlValues.join(",");

		mysqlConnection.connect();
		mysqlConnection.query(sqlCommand, function (error, results, fields) {
			if (error) throw error;
			console.log("Inserted: " + totalSqlValues.join(",") );
		});

		mysqlConnection.end();
	}

	// mongo insert
	if ( totalCollects.length ) {
		MongoClient.connect(mongoConf.url, function(err, client) {
			if(err) throw err;

			const db = client.db(mongoConf.db);

			totalCollects.forEach(function(data){
				db.collection(mongoConf.collection, function(err, collection){
					collection.insertOne(data);
				});
				console.log("Inserted: " + JSON.stringify(data) );
			});

			client.close();
		});
	}
}

mainProcess();
