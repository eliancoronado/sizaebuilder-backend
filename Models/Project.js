const mongoose = require("mongoose")

const projectSchema = new mongoose.Schema({
  authorId: {
    type: String, // Referencia a la colección de usuarios
    required: true,
  },
  name: {
    type: String,
    default: "Untitled",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  pages: [
    {
      name: { type: String, required: true },
      elements: { type: [Object], default: [] }, // Debe ser un arreglo de objetos
      code: { type: String, default: "" }, // Código JavaScript generado
      state: { type: Object, default: {} }, // JSON con el estado de los bloques
      stylesGlobal: { type: Object, default: {} }, // JSON con los estilos de los bloques
    }
  ],
});

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;