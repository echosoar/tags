import { MysqlDialect, MemoryDialect } from "./dialect";
import { TAG_ERROR } from "./error";
import { ITagBindOptions, ITagDefine, ITagDialect, ITagInitOptions, ITagItem, ITagListInstanceOptions, ITagListInstanceTagsOptions, ITagListResult, ITagOperResult, ITagSearchOptions } from "./interface";
import { error } from "./utils";
export * from './interface';
export * from './error';
export class TagService implements ITagDialect {
  private initOptions: ITagInitOptions;
  private dialect: ITagDialect;
  constructor(initOptions: ITagInitOptions) {
    this.initOptions = initOptions;
    switch(this.initOptions.dialect?.dialectType) {
      case 'mysql':
        this.dialect = new MysqlDialect(this.initOptions);
        break;
      default:
        this.dialect = new MemoryDialect();
        break;
    }
  }

  async ready() {
    await this.dialect.ready();
  }

  async new(tagDefine: ITagDefine) {
    return this.dialect.new(tagDefine);
  }

  async remove(tagIdOrName: number | string): Promise<ITagOperResult> {
    return this.dialect.remove(tagIdOrName);
  }

  async update(tagIdOrName: number | string, params: Partial<ITagDefine>): Promise<ITagOperResult> {
    return this.dialect.update(tagIdOrName, params);
  }
  async list(listOptions?: ITagSearchOptions): Promise<ITagListResult<ITagItem>> {
    return this.dialect.list({
      page: 1,
      pageSize: 20,
      ...listOptions
    });
  }

  async bind(bindOptions: ITagBindOptions): Promise<ITagOperResult> {
    if (!bindOptions.tags?.length) {
      return error(TAG_ERROR.MISSING_PARAMETERS, { need: 'tags' });
    }
    return this.dialect.bind(bindOptions);
  }

  async unbind(unbindOptions: ITagBindOptions): Promise<ITagOperResult> {
    return this.dialect.unbind(unbindOptions);
}

  async listInstance(listOptions?: ITagListInstanceOptions): Promise<ITagListResult<number>> {
    return this.dialect.listInstance({
      page: 1,
      pageSize: 20,
      tags: [],
      ...listOptions
    });
  }

  async listInstanceTags(listOptions?: ITagListInstanceTagsOptions): Promise<ITagListResult<ITagItem>> {
    return this.dialect.listInstanceTags({
      page: 1,
      pageSize: 20,
      ...listOptions
    });
  }
}

export const makeTagService = async (initOptions: ITagInitOptions): Promise<TagService> => {
  const tagService = new TagService(initOptions);
  await tagService.ready();
  return tagService;
}