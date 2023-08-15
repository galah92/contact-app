import express from "express";
import cookieParser from "cookie-parser";
import { Eta } from "eta";
import { initializeApp } from "firebase-admin/app";
import { DecodedIdToken, getAuth } from "firebase-admin/auth";
import * as contactsRepo from "./contact";

const app = express();
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const eta = new Eta({ views: "/", cache: false, useWith: true });

app.engine("eta", (path, data, callback) => {
  const rendered = eta.render(path, data);
  return callback(null, rendered);
});

app.set("view engine", "eta");

initializeApp();

app.post("/sessionLogin", (req, res) => {
  // Get the ID token passed and the CSRF token.
  const idToken = req.query.idToken?.toString();
  if (!idToken) {
    res.status(401).send("UNAUTHORIZED REQUEST!");
    return;
  }
  // // Guard against CSRF attacks.
  // const csrfToken = req.query.csrfToken?.toString();
  // if (csrfToken !== req.cookies.csrfToken) {
  //   res.status(401).send("UNAUTHORIZED REQUEST!");
  //   return;
  // }
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // Set session expiration to 5 days.
  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  getAuth()
    .createSessionCookie(idToken, { expiresIn })
    .then(
      (sessionCookie) => {
        // Set cookie policy for session cookie.
        const options = { maxAge: expiresIn, httpOnly: true, secure: true };
        res.cookie("session", sessionCookie, options);
        res.redirect("/profile");
      },
      (error) => {
        res.status(401).send("UNAUTHORIZED REQUEST!");
      }
    );
});

const authenticate: express.RequestHandler = (req, res, next) => {
  // Verify the session cookie. In this case an additional check is added to detect
  // if the user's Firebase session was revoked, user deleted/disabled, etc.
  const sessionCookie = req.cookies.session || "";
  getAuth()
    .verifySessionCookie(sessionCookie, true /** checkRevoked */)
    .then((decodedClaims) => {
      res.locals.user = decodedClaims;
      next();
    })
    .catch(() => {
      // Session cookie is unavailable or invalid. Force user to login.
      res.redirect("/login");
    });
};

interface UserResponse extends express.Response {
  locals: Record<string, any> & { user: DecodedIdToken };
}

app.use("/profile", authenticate);
app.get("/profile", (_req, res: UserResponse) => {
  const email = res.locals.user.email;
  res.render("profile", { email });
});

app.get("/login", (_req, res) => {
  res.render("login", {});
});

app.get("/", (_req, res) => {
  res.redirect("/profile");
});

app.get("/logout", function (req, res) {
  // Clear cookie.
  const sessionCookie = req.cookies.session || "";
  res.clearCookie("session");
  // Revoke session too. Note this will revoke all user sessions.
  if (sessionCookie) {
    getAuth()
      .verifySessionCookie(sessionCookie, true)
      .then(function (decodedClaims) {
        return getAuth().revokeRefreshTokens(decodedClaims.sub);
      })
      .then(function () {
        res.redirect("/"); // Redirect to login page on success.
      })
      .catch(function () {
        res.redirect("/"); // Redirect to login page on error.
      });
  } else {
    // Redirect to login page when no session cookie available.
    res.redirect("/");
  }
});

app.get("/contacts", (req, res) => {
  const q = req.query.q as string | undefined;
  const page = Number(req.query.page ?? "1");
  const contacts = q ? contactsRepo.search(q) : contactsRepo.all(page);
  const name = q ?? "";
  res.render("index", { name, contacts, page });
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
  const email = (req.query.email ?? "") as string;
  const contact = { ...existingContact, email };
  contactsRepo.validate(contact);
  res.send(contact.errors.email ?? "");
});

const port = Number(process.env.PORT ?? "3000");
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
