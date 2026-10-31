# Identity

Who people are and how they prove it: accounts, sign-in, and sign-out.

## Language

**User**:
A person with an account who can sign in.
_Avoid_: Account, profile

**Display name**:
The name a user chooses to be shown to other people.
_Avoid_: Username, nickname, full name

**Credentials**:
The email address and password a user proves who they are with.
_Avoid_: Login, account details

**Session**:
One signed-in stretch of a user on one browser, from sign-in until it ends through sign-out, expiry, or a password change. A user can have several sessions at once.
_Avoid_: Login, token

**Sign-in**:
A user presenting valid credentials, which starts a new session.
_Avoid_: Log in, login, authenticate

**Sign-out**:
A user ending a session on purpose: the current one, or all of them at once.
_Avoid_: Log out, logout
