// const MongoClient = require('mongodb').MongoClient;
// const mysql = require('mysql');

// const axios = require('axios');

// const mongoUrl = "mongodb://localhost:27017";		
// const mongodbName = "sensor";
// const mongoCollectionName = "rawdata";

// const mysqlConnection = mysql.createConnection({
// 	host     : 'localhost',
// 	user     : 'root',
// 	password : '9583ttld',
// 	database : 'soon8'
// });
// const mysqlTablename = "sensor_rawdata";

// function objectToParameters(obj){
// 	return Object.keys(obj).map(function(key){ return key + "=" + obj[key]; }).join('&');
// }

// function lessTenAddZero(v) { return v < 10? ("0" + v) : v; };

// Date.prototype.yymmddHHmmss = function() {
// 	var mm = this.getMonth() + 1, // getMonth() is zero-based
//         dd = this.getDate();
//     return [
//     	[ this.getFullYear(), lessTenAddZero(mm), lessTenAddZero(dd) ].join('-'),
//     	[ lessTenAddZero(this.getHours()), lessTenAddZero(this.getMinutes()), lessTenAddZero(this.getSeconds()) ].join(':')
//     ].join(" ");
// };

// const houseIeee = "00137A000003AC18";
// const ieeeList = ["00137A0000047DC4","00137A0000047DE8"];
// const dataKeys = ["voltage","temperature","humidity"];

// const requestParameters = {
// 	json: JSON.stringify({houseIeee:houseIeee,orderBy:""}),
// 	"encodemet%20hod": "AES",
// 	houseIeeeSecret: houseIeee,
// 	sign: "AAA"
// };

// const remoteUrl = "http://210.61.40.166:8081/zigBeeDevice/deviceController/getfindlist.do?";

// const responseRe = new RegExp("null\\((.*)\\)");

// new Promise(function(resolve, reject){
// 	const fetchedDatetime = (new Date()).yymmddHHmmss();
// 	axios.get(remoteUrl + objectToParameters(requestParameters))
// 		.then(function(result){
// 			const matches = result.data.match(responseRe);
// 			let dataSet = [];
// 			if (matches && matches.length) {
// 				const response = JSON.parse(matches[1]);
// 				const resList = response.response_params;
// 				if (resList && resList.length){
// 					dataSet = resList.filter(function(item){
// 						return ieeeList.indexOf(item.ieee) != -1;
// 					})
// 					.map(function(item){
// 						let insertData = {
// 							_last_time: fetchedDatetime,
// 							_name: item.deviceName,
// 							_houseieee: item.houseIeee,
// 							_ieee: item.ieee
// 						};
// 						let ids = item.clusterIds.split(',');
// 						let values = item.vals.split(',').map(function(val){return parseFloat(val).toFixed(2); });
// 						let valueMap = {};
						
// 						ids.forEach(function(id, idx){
// 							valueMap[id] = values[idx];
// 						});

// 						var sortedKeys = Object.keys(valueMap);

// 						sortedKeys.sort();

// 						sortedKeys.forEach(function(key, idx){
// 							insertData[ dataKeys[idx] ] = valueMap[key];
// 						});

// 						return insertData;
// 					});
// 				}
// 			}
// 			resolve(dataSet);
// 		})
// 		.catch(function(err){ reject(err); });
// })
// .then(function(results){

// 	let sqlCommand = "";
// 	let sqlValues = results.map(function(item){
// 		return "(" + 
// 			[
// 				"'" + item._ieee + "'", 
// 				"'" + item._last_time + "'", 
// 				item.voltage, 
// 				item.temperature, 
// 				item.humidity
// 			].join(',')
// 		+ ")";
// 	});

// 	if ( sqlValues.length ) {
// 		sqlCommand = "INSERT INTO " + mysqlTablename + " (ieee, time, voltage, temperature, humidity) VALUES " + sqlValues.join(",");
// 	}

// 	MongoClient.connect(mongoUrl, function(err, client) {
// 		if(err) throw err;

// 		const db = client.db(mongodbName);

// 		results.forEach(function(data){
// 			db.collection(mongoCollectionName,function(err,collection){
// 				collection.insertOne(data);
// 			});
// 			console.log("Inserted: " + JSON.stringify(data) );
// 		})

// 		client.close();
// 	});

// 	if (sqlCommand) {
// 		mysqlConnection.connect();

// 		mysqlConnection.query(sqlCommand, function (error, results, fields) {
// 			if (error) throw error;
			
// 			console.log("Inserted: " + sqlValues.join(",") );
// 		});

// 		mysqlConnection.end();
// 	}
// });

// about date time
const datetimeFormat = "YYYY-MM-DD HH:mm:ss";
const moment = require('moment');
const executeDatetime = moment().format(datetimeFormat);
const previousMins = 62;	// to ignore errors if voltage delay

// secrets
const secrets = require('./secrets');

// devices
const devices = require('./devices');

const utils = require('./utils');

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

const generateSql = (collects) => {
	let sqlValues = collects.map(tuple => {
		return "(" + tableCols.map(col => {
			let name = col.name;
			let type = col.type;
			if (type == "string") {
				return "'" + tuple[name] + "'";
			} else return tuple[name];
		}).join(",") + ")";
	});
	
	let resCommand = "INSERT INTO " + secrets.mysql.table + " (" + tableCols.map(c => c.name).join(",") + ") VALUES " + sqlValues.join(",");

	return resCommand;
};

Object.keys(devices).forEach(async (ieee) => {
	const devIds = devices[ieee];

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
		let sqlCommand = generateSql(collects);
		
		console.log(collects);
		console.log(sqlCommand);
		
	} else console.log(resdata);

	await utils.sleep(5000);
});
