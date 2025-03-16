const { DataTypes } = require("sequelize");
const sequelize = require("../database");


const Client = sequelize.define('Client', {
    username: {
        type:DataTypes.STRING,
        allowNull: false,
        unique:true,
    },
    password: {
        type:DataTypes.STRING,
        allowNull:false,
    },
    fcmToken: {
        type:DataTypes.STRING,
        allowNull:true,
        defaultValue:"",
    }
});

module.exports = Client;