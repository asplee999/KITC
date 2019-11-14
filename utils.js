
// secrets
const secrets = require('./secrets');

const axios = require('axios');
const md5 = require('md5');

const account = secrets.account;
const password = secrets.password;

const baseUrl = "http://mngm2.netvoxcloud.com:80/smarthome/api/";
const action = "cloud.do";

let axiosIns = axios.create({
	baseURL: baseUrl,
	timeout: 100000
});

const paramToQuery = function(obj){
	return Object.keys(obj).map(k => {
		return k + "=" + obj[k];
	}).join("&");
};

module.exports = {
	requestData: async function(options){
		let params = {
			data: JSON.stringify(options),
			seq: 1234,
			timestamp: new Date().getTime(),
			user: account
		};

		let strToSign = paramToQuery(params) + "&" + password;
		let res = await axiosIns.get(action, { params: Object.assign({}, params, { sign: md5(strToSign) }) });

		return res.data;
	},
	sleep: function(millis){
		return new Promise(resolve => setTimeout(resolve, millis));
	}
};
