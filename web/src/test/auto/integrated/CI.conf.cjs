var BASE_CONFIG = require("./base.conf.js");
var ci_config_adapter = require("../../../../../common/test/resources/karma-browserstack-config.cjs");

module.exports = ci_config_adapter(BASE_CONFIG, "full");