export class DriveAuthError extends Error {
  constructor() {
    super("Google Drive authentication expired — please sign in again");
    this.name = "DriveAuthError";
  }
}
