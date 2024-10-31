import e from "express";
import http, { createServer } from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";

const app = e();

const PORT = 5000;

app.use(e.static("public"));

app.use(e.json());
app.use(e.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
  res.render("welcome");
});

app.get("/profile", (req, res) => {
  res.render("components/mapping");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
