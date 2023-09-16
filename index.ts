import express from "express";
import { Eta } from "eta";
import * as contactsRepo from "./contact";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));

const eta = new Eta({ views: "/", cache: false, useWith: true });

app.engine("eta", (path, data, callback) => {
  const rendered = eta.render(path, data);
  return callback(null, rendered);
});

app.set("view engine", "eta");

app.get("/", (_req, res) => {
  res.redirect("/contacts");
});

app.get("/contacts", (req, res) => {
  const query = req.query.q?.toString();
  const page = Number(req.query.page ?? "1");
  const contacts = query ? contactsRepo.search(query) : contactsRepo.all(page);
  const isActiveSearch = req.header("HX-Trigger") === "search";
  if (isActiveSearch && query) {
    // we assume all seaches are htmx requests
    return res.render("rows", { contacts });
  }
  const name = query ?? "";
  res.render("index", { name, contacts, page });
});

app.get("/contacts/count", async (_req, res) => {
  const count = await contactsRepo.count();
  res.send(`(${count} total Contacts)`);
});

app.get("/contacts/new", (_req, res) => {
  const contact: contactsRepo.Contact = {
    id: 0,
    first: "",
    last: "",
    phone: "",
    email: "",
    errors: {},
  };
  res.render("new", { contact });
});

app.post("/contacts/new", (req, res) => {
  const contact = req.body as contactsRepo.Contact;
  if (!contact.email) {
    contact.errors = { email: "Email is required" };
    res.render("new", { contact });
    return;
  }
  contactsRepo.save(contact);
  res.redirect("/contacts");
});

app.get("/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const contact = contactsRepo.find(id);
  if (!contact) {
    res.status(404).send("Not found");
    return;
  }
  res.render("show", { contact });
});

app.delete("/contacts/:id", (req, res) => {
  const id = Number(req.params.id);
  const contact = contactsRepo.find(id);
  if (!contact) {
    res.status(404).send("Not found");
    return;
  }
  contactsRepo.remove(id);
  const isDeleteFromEditPage = req.header("HX-Trigger") === "delete-button";
  if (!isDeleteFromEditPage) {
    return res.send("");
  }
  res.redirect(303, "/contacts");
});

app.get("/contacts/:id/edit", (req, res) => {
  const id = Number(req.params.id);
  const contact = contactsRepo.find(id);
  if (!contact) {
    res.status(404).send("Not found");
    return;
  }
  res.render("edit", { contact });
});

app.post("/contacts/:id/edit", (req, res) => {
  const newContact = req.body as contactsRepo.Contact;
  if (!newContact.email) {
    newContact.errors = { email: "Email is required" };
    res.render("edit", { contact: newContact });
    return;
  }
  const id = Number(req.params.id);
  const existingContact = contactsRepo.find(id);
  if (!existingContact) {
    res.status(404).send("Not found");
    return;
  }
  const contact = { ...existingContact, ...newContact };
  const success = contactsRepo.save(contact);
  if (success) {
    res.redirect("/contacts");
  } else {
    res.render("edit", { contact });
  }
});

app.get("/contacts/:id/email", (req, res) => {
  const id = Number(req.params.id);
  const existingContact = contactsRepo.find(id);
  if (!existingContact) {
    res.status(404).send("Not found");
    return;
  }
  const email = req.query.email?.toString() ?? "";
  const contact = { ...existingContact, email };
  contactsRepo.validate(contact);
  res.send(contact.errors.email ?? "");
});

const port = Number(process.env.PORT ?? "3000");
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
