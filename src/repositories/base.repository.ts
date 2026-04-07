import { Model, ModelStatic, FindOptions } from "sequelize";

export abstract class BaseRepository<T extends Model> {
  protected readonly model: ModelStatic<T>;

  constructor(model: ModelStatic<T>) {
    this.model = model;
  }

  public async getById(id: string): Promise<T | null> {
    return this.model.findByPk(id);
  }

  public async get(options?: FindOptions): Promise<T[]> {
    return this.model.findAll(options);
  }

  public async add(data: Partial<T>): Promise<T> {
    return this.model.create(data as any);
  }

  public async update(id: string, data: Partial<T>): Promise<T | null> {
    const instance = await this.getById(id);
    if (!instance) {
      return null;
    }

    return instance.update(data);
  }

  public async remove(id: string): Promise<boolean> {
    const instance = await this.getById(id);
    if (!instance) {
      return false;
    }

    await instance.destroy();
    return true;
  }
}
