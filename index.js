//mongodb+srv://cuentaparaelian12:hf9HEYDTsUy6YHPc@cluster0.citmxdl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
const http = require("http");
const User = require("./Models/Users");
const Project = require("./Models/Project");
const path = require("path");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const multer = require("multer");
const archiver = require("archiver"); // Para crear el archivo ZIP

mongoose
  .connect(
    "mongodb+srv://cuentaparaelian12:hf9HEYDTsUy6YHPc@cluster0.citmxdl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(() => console.log("MongoDB Connected"));

const app = express();

app.use(express.json());
//app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cors({ origin: "https://sizae-frontend.netlify.app", credentials: true }));
app.use("/images", express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "dist")));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://sizae-frontend.netlify.app");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Crear un almacenamiento con Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crear el directorio del usuario si no existe
    const uploadDir = path.join(__dirname, "dist", req.params.prid);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir); // Guardar archivos en el directorio del usuario
  },
  filename: (req, file, cb) => {
    // Asignar un nombre único a cada archivo
    const fileExtension = path.extname(file.originalname);
    const uniqueName = `${Date.now()}${fileExtension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

// Middleware para servir archivos estáticos según el ID
app.use("/dist/:id", (req, res, next) => {
  const { id } = req.params;
  const projectPath = path.join(__dirname, "dist", id);

  console.log(`Buscando en: ${projectPath}`); // Log para verificar la ruta

  if (fs.existsSync(projectPath)) {
    console.log("Carpeta encontrada");
    express.static(projectPath)(req, res, next);
  } else {
    console.log("Carpeta no encontrada");
    res.status(404).send("Proyecto no encontrado");
  }
});

// Ruta específica para enviar el archivo index.html
app.get("/dist/:id/index.html", (req, res) => {
  const { id } = req.params;
  const indexPath = path.join(__dirname, "dist", id, "index.html");

  console.log(`Buscando archivo: ${indexPath}`); // Log para verificar la ruta del archivo

  if (fs.existsSync(indexPath)) {
    console.log("Archivo encontrado");
    res.sendFile(indexPath);
  } else {
    console.log("Archivo no encontrado");
    res.status(404).send("Archivo index.html no encontrado");
  }
});

app.use(express.urlencoded({ extended: true })); // Para formularios codificados en URL

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Aquí debes colocar la URL del frontend
    methods: ["GET", "POST"],
  },
});

// Evento de conexión de Socket.IO
io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  socket.on("changeSelectedPage", ({ projectId, selectedPage }) => {
    console.log(`Cambio de página en proyecto ${projectId}: ${selectedPage}`);

    // Emitir el cambio a todos los clientes excepto al que envió el evento
    socket.broadcast.emit("selectedPageChanged", { projectId, selectedPage });
  });

  socket.on("draggingElementStarted", ({ id, draggingElement }) => {
    // Emitir el evento a todos los demás clientes
    socket.broadcast.emit("draggingElementUpdated", { id, draggingElement });
  });

  // Escucha la desconexión
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

app.put("/projects/:id", async (req, res) => {
  try {
    const { pages } = req.body;

    // Buscar el proyecto por su ID
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { pages }, // Actualizar las páginas del proyecto
      { new: true }
    );

    // Si no se encuentra el proyecto
    if (!updatedProject) {
      return res.status(404).send("Proyecto no encontrado");
    }

    // Emitir el evento de actualización al cliente
    io.emit("project-updated", updatedProject);

    // Devolver el proyecto actualizado
    res.json(updatedProject);
  } catch (error) {
    console.error("Error al actualizar el proyecto:", error);
    res.status(500).send("Error al actualizar el proyecto");
  }
});

function renderElement(element) {
  if (!element || typeof element !== "object") {
    throw new Error(`Invalid element: ${JSON.stringify(element)}`);
  }

  const {
    id,
    name,
    text = "",
    children = [],
    styles = {},
    iconClass = "",
    placeholder = "",
    type = "",
    src = "",
  } = element;

  // Asegurarse de que el elemento `name` sea válido
  const validTags = [
    "Container",
    "Text",
    "Input",
    "Button",
    "Image",
    "Icon",
    "Select",
    "Option",
  ];
  if (!validTags.includes(name)) {
    throw new Error(`Invalid tag name: ${name}`);
  }

  // Establecer el nombre de la etiqueta HTML según el tipo de elemento
  const tag =
    name === "Container"
      ? "div"
      : name === "Text"
      ? "h3"
      : name === "Icon"
      ? "i"
      : name === "Image"
      ? "img"
      : name.toLowerCase();

  // Convertir estilos en un string de CSS
  const styleString = Object.entries(styles)
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value};`
    )
    .join(" ");

  // Agregar el id al atributo 'id' y la clase 'iconClass' si el elemento es un ícono
  const idAttribute = id ? `id="${id}" ` : ""; // Solo añade el atributo id si está presente
  const iconClassName =
    name === "Icon" && iconClass ? `class="${iconClass}" ` : ""; // Añadir clase para íconos
  const placeholderAtr =
    name === "Input" && placeholder ? `placeholder="${placeholder}" ` : ""; // Añadir clase para íconos
  const typeInputAtr = name === "Input" && type ? `type="${type}"` : "";
  const srcAtr = name === "Image" && src ? `src="${src.split("/").pop()}"` : "";

  // Elementos auto-cerrados
  const selfClosingTags = ["input", "img", "br", "hr", "meta", "link"];

  if (selfClosingTags.includes(tag)) {
    return `<${tag} ${idAttribute}${typeInputAtr}${srcAtr}style="${styleString}" ${placeholderAtr} />`;
  }

  // Renderizar los hijos recursivamente
  const childrenHTML = children.map(renderElement).join("");

  // Retornar el HTML del elemento con id y clases
  return `<${tag} ${idAttribute}${iconClassName}style="${styleString}">${text}${childrenHTML}</${tag}>`;
}

// Función para generar el HTML completo
function generateHTML(droppedElement) {
  try {
    if (Array.isArray(droppedElement)) {
      return droppedElement.map(renderElement).join("");
    }
    if (typeof droppedElement === "object" && droppedElement !== null) {
      return renderElement(droppedElement);
    }
    throw new Error("Invalid droppedElement");
  } catch (error) {
    console.error("Error generating HTML:", error);
    return "";
  }
}

// Ruta para manejar la vista previa y guardar el archivo HTML
app.post("/generate", (req, res) => {
  const { droppedElement, selectedPage, jscode, id } = req.body;

  // Validar los campos requeridos
  if (!droppedElement || !selectedPage || !id) {
    return res.status(400).json({
      error: "Missing required fields: droppedElement, selectedPage, or id",
    });
  }

  // Generar el contenido HTML
  const bodyContent = generateHTML(droppedElement);
  const fullHTML = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${selectedPage}</title>
      <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
      <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Oswald:wght@200..700&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        *{
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
        body, html{
        width: 100%;
        height: 100vh;
        position: relative;
        }
      </style>
  </head>
  <body>
      ${bodyContent}
      <script>
        ${jscode}
      </script>
  </body>
  </html>`;

  // Ruta base de la carpeta dist
  const distDir = path.join(__dirname, "dist");
  // Ruta de la subcarpeta basada en el id
  const subDir = path.join(distDir, id);
  // Ruta completa del archivo
  const filePath = path.join(subDir, `${selectedPage}.html`);

  // Verificar si la carpeta dist y la subcarpeta existen, si no, crearlas
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  if (!fs.existsSync(subDir)) {
    fs.mkdirSync(subDir, { recursive: true });
  }

  // Verificar si el archivo ya existe y eliminarlo
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Error deleting existing file:", err);
      return res.status(500).json({ error: "Failed to delete existing file" });
    }
  }

  // Guardar el archivo HTML en la subcarpeta
  fs.writeFile(filePath, fullHTML, (err) => {
    if (err) {
      console.error("Error saving file:", err);
      return res.status(500).json({ error: "Failed to save HTML file" });
    }
    res.json({
      message: "HTML file generated successfully",
      filePath,
    });
  });
});

app.get("/download-zip/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing required parameter: id" });
  }

  const subDirPath = path.join(__dirname, "dist", id); // Ruta a la subcarpeta dist/${id}
  const zipName = `${id}.zip`;

  // Verificar si la carpeta dist/${id} existe
  if (!fs.existsSync(subDirPath)) {
    return res
      .status(404)
      .json({ error: `Directory dist/${id} does not exist` });
  }

  // Configurar la respuesta como descarga
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=${zipName}`);

  // Crear el archivo ZIP y enviarlo
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error(err);
    res.status(500).send("Error al crear el archivo ZIP.");
  });

  archive.pipe(res); // Enviar el archivo al cliente
  archive.directory(subDirPath, false); // Agregar la carpeta dist/${id} al ZIP
  archive.finalize(); // Finalizar el archivo ZIP
});

app.post("/register", async (req, res) => {
  const { username, email, pass } = req.body;
  if (!username || !email || !pass) {
    res.status(400).send("Campos Faltantes");
    console.log("No has completado los campos correspondientes");
  }
  try {
    const newUser = new User({
      username,
      email,
      pass,
    });
    await newUser.save();
    console.log("Usuario creado con éxito");
    res.status(200).json(newUser);
  } catch (error) {
    console.log("Un error ha ocurrido mientras se registra", error);
  }
});
app.post("/login", async (req, res) => {
  const { email, pass } = req.body;
  if (!email || !pass) {
    res.status(400).send("Campos Faltantes");
    console.log("No has completado los campos correspondientes");
  }
  try {
    const user = await User.findOne({ email, pass });
    if (!user) {
      res.status(400).send("Usuario o contraseña incorrectos");
    }
    console.log("Usuario loggeado con éxito");
    res.status(200).json(user);
  } catch (error) {
    console.log("Un error ha ocurrido mientras se loggea", error);
  }
});

app.get("/all-users", async (req, res) => {
  try {
    const allusers = await User.find();
    res.status(200).json(allusers);
  } catch (error) {
    console.log("Error al ver todos los usuarios", error);
  }
});

app.get("/projects/:id", async (req, res) => {
  try {
    const userProjects = await Project.find({ authorId: req.params.id });
    res.status(200).json(userProjects);
  } catch (error) {
    console.log("Error al ver todos los usuarios", error);
  }
});

app.post("/new-project", async (req, res) => {
  const { authorId } = req.body;

  if (!authorId) {
    return res.status(400).send("You need the author Id");
  }

  try {
    // Crear un nuevo proyecto con la página 'index'
    const newProject = new Project({
      authorId,
      pages: [
        {
          name: "index", // Nombre de la página
          elements: [], // Elementos iniciales vacíos para la página 'index'
        },
      ],
    });

    // Guardar el proyecto con la página 'index'
    await newProject.save();

    // Devolver la respuesta con el proyecto creado
    res.status(201).json(newProject);
  } catch (error) {
    console.error("An error occurred while creating the project:", error);
    res.status(500).send("An error occurred while creating the project");
  }
});

app.get("/all-projects", async (req, res) => {
  try {
    const allprojects = await Project.find();
    res.status(200).json(allprojects);
  } catch (error) {
    res.status(500).send("An error occurred while seeing the project");
  }
});

app.get("/project/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).send("Proyecto no encontrado");
    }
    res.status(200).json(project); // No necesitas hacer nada especial aquí, ya que el arreglo de objetos se devolverá correctamente
  } catch (error) {
    res.status(500).send("Error al obtener el proyecto");
  }
});

app.delete("/delete-project/:id", async (req, res) => {
  const projectId = req.params.id;

  try {
    // Elimina el proyecto de la base de datos (ejemplo con MongoDB)
    const deletedProject = await Project.findByIdAndDelete(projectId);

    if (!deletedProject) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    // Ruta de la imagen asociada
    const imagePath = path.join(__dirname, "public", `${projectId}.png`);

    // Elimina la imagen si existe
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    } else {
      console.log("Imagen no encontrada, pero el proyecto fue eliminado");
    }

    // Ruta de la carpeta en dist asociada al proyecto
    const projectDir = path.join(__dirname, "dist", projectId);

    // Elimina la carpeta si existe
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      console.log(`Carpeta dist/${projectId} eliminada`);
    } else {
      console.log(`Carpeta dist/${projectId} no encontrada`);
    }

    res
      .status(200)
      .json({ message: "Proyecto, imagen y carpeta eliminados con éxito" });
  } catch (error) {
    console.error("Error al eliminar el proyecto:", error);
    res.status(500).json({ message: "Error al eliminar el proyecto" });
  }
});

app.delete("/delete-projects", async (req, res) => {
  try {
    const result = await Project.deleteMany({}); // Borra todos los documentos
    res.status(200).json({
      message: "Todos los proyectos han sido eliminados",
      deletedCount: result.deletedCount, // Opcional: muestra cuántos proyectos fueron eliminados
    });
  } catch (error) {
    console.error("Error al borrar todos los proyectos:", error);
    res.status(500).json({ error: "Error al borrar todos los proyectos" });
  }
});

app.post("/save-image", (req, res) => {
  const { image, id } = req.body; // Obtiene la imagen y el id del cuerpo de la solicitud

  if (!image || !id) {
    return res.status(400).send({ message: "Faltan datos: imagen o id." });
  }

  // Eliminar el encabezado "data:image/png;base64,"
  const base64Data = image.replace(/^data:image\/png;base64,/, "");

  // Ruta donde se guardará la imagen, usando el id como nombre
  const imagePath = path.join(__dirname, "public", `${id}.png`);

  // Verificar si la imagen ya existe
  if (fs.existsSync(imagePath)) {
    // Si existe, eliminarla
    fs.unlinkSync(imagePath);
    console.log(`Imagen previa eliminada: ${imagePath}`);
  }

  // Guardar la nueva imagen como archivo
  fs.writeFile(imagePath, base64Data, "base64", (err) => {
    if (err) {
      console.error("Error al guardar la imagen:", err);
      return res.status(500).send({ message: "Error al guardar la imagen." });
    }
    res.send({
      message: "Imagen guardada con éxito.",
      path: `/public/${id}.png`,
    });
  });
});

// Endpoint para subir imágenes con multer
app.post("/upload/:prid", upload.single("image"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "No se subió ninguna imagen" });

  res.status(200).json({
    message: "Imagen subida con éxito",
    filePath: `/dist/${req.params.prid}/${req.file.filename}`,
  });
});

// Ruta para obtener las imágenes subidas
app.get("/imagesuploaded/:prid", (req, res) => {
  const imagesDir = path.join(__dirname, "dist", req.params.prid);
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).send("Error al leer el directorio de imágenes.");
    }
    const imagePaths = files.map((file) => `/dist/${req.params.prid}/${file}`);
    res.json({ images: imagePaths }); // Devolver las rutas de todas las imágenes
  });
});

// Servir imágenes
app.use("/dist", express.static(path.join(__dirname, "dist")));

/*
app.post("/upload/:prid", (req, res) => {
  const base64Image = req.body.image; // Se espera que la imagen venga en formato base64
  const extension = req.body.extension || "png"; // Extensión predeterminada
  const fileName = `${Date.now()}.${extension}`;
  const filePath = path.join(uploadDir, fileName);

  // Decodificar y guardar el archivo
  const buffer = Buffer.from(base64Image, "base64");
  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("Error al guardar la imagen:", err);
      return res.status(500).json({ message: "Error al guardar la imagen" });
    }

    res.status(200).json({
      message: "Imagen subida con éxito",
      filePath: `/upload/${fileName}`,
    });
  });
});
*/

app.put("/update-project/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const project = await Project.findByIdAndUpdate(
      id,
      { name },
      { new: true } // Retorna el proyecto actualizado
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating project" });
  }
});

app.put("/addNewPage/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).send("Proyecto no encontrado");
    }

    // Actualizar las páginas del proyecto
    project.pages = req.body.pages;

    // Guardar el proyecto actualizado
    await project.save();

    res.json(project);
  } catch (error) {
    console.error("Error al actualizar el proyecto:", error);
    res.status(500).send("Error al actualizar el proyecto");
  }
});

/*
app.get("/imagesuploaded", (req, res) => {
  const uploadDir = path.join(__dirname, "upload");
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error al leer la carpeta:", err);
      return res.status(500).json({ message: "Error al obtener imágenes" });
    }

    // Devolver las rutas relativas
    const images = files.map((file) => `/upload/${file}`);
    res.status(200).json({ images });
  });
});
*/

server.listen(4000, () => {
  console.log("Servidor escuchando en http://localhost:4000");
});
