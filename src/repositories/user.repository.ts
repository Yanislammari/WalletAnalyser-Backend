import { User } from "../db_schema/users/users";
import { BaseRepository } from "./base.repository";

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  public async getByEmail(email: string): Promise<User | null> {
    return this.model.findOne({ where: { email } });
  }

  public async getByGoogleId(googleId: string): Promise<User | null> {
    return this.model.findOne({ where: { googleId } });
  }

  public async activateUser(userId: string): Promise<void> {
    await this.model.update({ activated: true }, { where: { id: userId } });
  }
}
