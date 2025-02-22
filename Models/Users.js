const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  pass: { type: String },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
