import { TAG_ERROR } from "../error";
import { ITagBindOptions, ITagDefine, ITagDialect, ITagItem, ITagListInstanceOptions, ITagListInstanceTagsOptions, ITagListResult, ITagOperResult, ITagSearchOptions } from "../interface";
import { error, formatMatchLike, getPageOpions, success } from "../utils";


export class MemoryDialect implements ITagDialect {
  // store tag information
  private tagStore = new Map<string|number, ITagItem>();
  // store relationship about tag and instance
  private tagRelationStore = new Map<`${number}-${number}`, boolean>();
  private tagIndex = 0;

  async ready(): Promise<void> {}

  async new(tagDefine: ITagDefine): Promise<ITagOperResult> {
      let tagId;
      const existTagItem = this.tagStore.get(tagDefine.name);
      if (existTagItem) {
        return error(TAG_ERROR.EXISTS, {
          id: existTagItem.id,
        });
      }
      tagId = (++this.tagIndex);
      const tagItem: ITagItem = {
        ...tagDefine,
        id: tagId,
        createAt: Date.now(),
        updateAt: Date.now(),
      };
      this.tagStore.set(tagId, tagItem);
      this.tagStore.set(tagItem.name, tagItem);
      return success({
        id: tagId
      });
  }

  async remove(tagIdOrName: number): Promise<ITagOperResult> {
    const tagItem: ITagItem = this.tagStore.get(tagIdOrName);
    if (!tagItem) {
      return error(TAG_ERROR.NOT_EXISTS, { id: tagIdOrName });
    }
    const { list: allObjectId } = await this.listInstance({
      tags: [tagItem.id],
      pageSize: Infinity,
    });
    for(const objId of allObjectId) {
      this.tagRelationStore.delete(`${tagItem.id}-${objId}`);
    }
    this.tagStore.delete(tagItem.name);
    this.tagStore.delete(tagItem.id);
    return success({ id: tagItem.id });
  }

  async update(tagIdOrName: number, params: Partial<ITagDefine>): Promise<ITagOperResult> {
    const tagItem: ITagItem = this.tagStore.get(tagIdOrName);
    if (!tagItem) {
      return error(TAG_ERROR.NOT_EXISTS, { id: tagIdOrName });
    }
    Object.assign(tagItem, {
      ...params,
      id: tagItem.id
    });
    return success({ id: tagItem.id });
  }
  async list(listOptions?: ITagSearchOptions): Promise<ITagListResult<ITagItem>> {
    const { page, pageSize, match = [], count } = listOptions;
    const { limit: start, end } = getPageOpions(page, pageSize);
    let matchedItemIndex = 0;
    const result: Array<ITagItem> = [];
    for(let i = 0; i <= this.tagIndex; i ++) {
      const tagItem = this.tagStore.get(i);
      if (!tagItem) {
        continue;
      }
      const matched = match.length ? !!match.find(matchItem => {
        
        if (typeof matchItem === 'string') {
          const { matchStart, matchEnd, text } = formatMatchLike(matchItem);
          if (matchEnd && matchStart) {
            return tagItem.name.includes(text)
          } else if (matchStart) {
            return tagItem.name.startsWith(text)
          } else if(matchEnd) {
            return tagItem.name.endsWith(text)
          } else {
            return tagItem.name === text;
          }
        }
        return tagItem.id === matchItem;
      }): true;

      if (matched) {
        if (matchedItemIndex >= start && matchedItemIndex < end) {
          result.push(tagItem);
          if (!count && result.length === pageSize) {
            break;
          }
        }
        matchedItemIndex ++;
      }
    }
    const returnResult: ITagListResult<ITagItem> = {
      list: result,
    }
    if (count) {
      returnResult.total = matchedItemIndex
    }
    return returnResult;
  }

  async bind(bindOptions?: ITagBindOptions): Promise<ITagOperResult> {
    let tagList: ITagItem[] = []
    try {
      tagList = await Promise.all(bindOptions.tags.map(async (tag) => {
        let tagItem = this.tagStore.get(tag);
        if (!tagItem) {
          if (typeof tag === 'string' && bindOptions.autoCreateTag) {
            const newTag = await this.new({
              name: tag,
              desc: 'auto create'
            });
            tagItem = this.tagStore.get(newTag.id);
          } else {
            throw error(TAG_ERROR.NOT_EXISTS, { id: tag })
          }
        }
        return tagItem;
      }));
    } catch(e) {
      return e;
    }
    for(const tagItem of tagList) {
      this.tagRelationStore.set(`${tagItem.id}-${bindOptions.objId}`, true);
    }
    return success();
  }


  async unbind(unbindOptions: ITagBindOptions): Promise<ITagOperResult> {
    for(const tag of unbindOptions.tags) {
      const tagItem = this.tagStore.get(tag);
      
      if (tagItem) {
        this.tagRelationStore.delete(`${tagItem.id}-${unbindOptions.objId}`);
      }
    }
    return success();
  }

  async listInstance(listOptions?: ITagListInstanceOptions): Promise<ITagListResult<number>> {
    const { page, pageSize, tags = [], count } = listOptions;
    const { limit: start, end } = getPageOpions(page, pageSize);
    let matchedItemIndex = 0;
    const result: Array<number> = [];
    const resultIdMap = {};

    for (let [relative] of this.tagRelationStore) {
      const [tagId, relaObjectId] = relative.split('-');
      if (resultIdMap[relaObjectId] && resultIdMap[relaObjectId].length === tags.length) {
        continue;
      }
      const tagItem = this.tagStore.get(+tagId);
      if (!tagItem) {
        continue;
      }
      let matched = tags.length ? !!tags.find(matchItem => {
        if (typeof matchItem === 'string') {
          return tagItem.name === matchItem;
        }
        return tagItem.id === matchItem;
      }): true;

      if (matched) {
        if (!resultIdMap[relaObjectId]) {
          resultIdMap[relaObjectId] = []
        }
        resultIdMap[relaObjectId].push( tagItem.id);
        if (resultIdMap[relaObjectId].length === tags.length) {
          if (matchedItemIndex >= start && matchedItemIndex < end) {
            result.push(+relaObjectId);
          }
          matchedItemIndex ++;
        }
        if (!count && result.length === pageSize) {
          break;
        }
        
      }
    }
    const returnResult: ITagListResult<number> = {
      list: result,
    }
    if (count) {
      returnResult.total = matchedItemIndex
    }
    return returnResult;
  }

  async listInstanceTags(listOptions?: ITagListInstanceTagsOptions): Promise<ITagListResult<ITagItem>> {
    const { page, pageSize, objId, count } = listOptions;
    const { limit: start, end } = getPageOpions(page, pageSize);
    let matchedItemIndex = 0;
    const result: Array<ITagItem> = [];
    const resultIdMap = {};

    for (let [relative] of this.tagRelationStore) {
      const [tagId, relaObjectId] = relative.split('-');
      if (+relaObjectId !== objId) {
        continue;
      }
      const tagItem = this.tagStore.get(+tagId);
      if (!tagItem || resultIdMap[tagId]) {
        continue;
      }
      resultIdMap[tagId] = true;
      if (matchedItemIndex >= start && matchedItemIndex < end) {
        result.push(tagItem);
      }
      matchedItemIndex ++;
    }
    const returnResult: ITagListResult<ITagItem> = {
      list: result,
    }
    if (count) {
      returnResult.total = matchedItemIndex
    }
    return returnResult;
  }
}