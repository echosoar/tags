import {makeTagService, TagService, TAG_ERROR } from '../src';
const mysql = require('mysql2');
import assert from 'assert';
describe('mysql.test.ts', () => {
  let connection;
  let tagService: TagService;
  beforeAll(async () => {
    connection = mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER || 'localtest',
      password: process.env.MYSQL_PASS || 'test',
      database: process.env.MYSQL_DB || 'localtest',
      charset: 'utf8',
    });
    const name = 'localtest3';
    // 清空表
    await connection.promise().query(`TRUNCATE TABLE \`${name}_tag\``);
    tagService = await makeTagService({
      type: name,
      dialect: {
        dialectType: 'mysql',
        sync: true,
        instance: {
          query: (...args) => {
            return connection.promise().query(...args);
          }
        }
      }
    })
  });
  afterAll(() => {
    connection.close();
  });
  it('new tag', async () => {
    const tag1Result = await tagService.new({
      name: 'test1',
      desc: 'desc test 1'
    });
    assert(tag1Result.success && tag1Result.id);

    const tag1ExistsResult = await tagService.new({
      name: 'test1',
      desc: 'desc test 1'
    });
    assert (!tag1ExistsResult.success && tag1ExistsResult.message === TAG_ERROR.EXISTS);
    const tag2Result = await tagService.new({
      name: 'test2',
      desc: 'desc test 2'
    });
    assert (tag2Result.success && tag2Result.id > tag1Result.id);
  });
  it('list tag', async () => {
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test-list-' + (i + 1),
        desc: 'desc test ' + (i + 1)
      })
    }
    // list top 20
    const result = await tagService.list({ count: true });
    assert(result.list.length === 20 && result.total >= 100);
    assert(result.list[0].id && result.list[0].name);
    // list page 2 and pageSize 17
    const result2 = await tagService.list({
      page: 2,
      pageSize: 17,
      count: false
    });
    assert(result2.list.length === 17 && !result2.total);
    assert(result.list[0].id && result.list[0].name);

    // macth/search/list
    const match = await tagService.list({
      match: [2, 4, '%-list-67', 'test-list-78', 'test-list-9%'],
      count: true
    });
    // 2/4/9/67/78/90~99
    assert(match.list.length === 15 && match.total === 15);
    assert(match.list[0].id === 2);
    assert(match.list[1].id === 4);
    assert(match.list[3].name.endsWith('-67'));
  });
  it('update tag', async () => {
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test-update-' + (i + 1),
        desc: 'desc test ' + (i + 1)
      })
    }
    const {list: [item23]} = await tagService.list({ match: [23] });
    const updateRes = await tagService.update(item23.id, {
      name: 'xxxx23',
      desc: 'descxxx23',
    });
    assert(updateRes.success && updateRes.id === item23.id);
    const find23 = await tagService.list({ match: [item23.id] });
    assert(find23.list.length === 1 && find23.list[0].id === item23.id && find23.list[0].name === 'xxxx23' && find23.list[0].desc === 'descxxx23');
    const {list: [item67]} = await tagService.list({ match: ['test-update-67'] });
    const updateByNameRes = await tagService.update(item67.name, {
      name: 'xxxx67',
      desc: 'descxxx67',
    });
    assert(updateByNameRes.success && updateByNameRes.id === item67.id);
  });
  it('remove tag', async () => {
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test-remove-' + (i + 1),
        desc: 'desc test ' + (i + 1)
      });
    }
    const {list: [item23]} = await tagService.list({ match: ['test-remove-23'] });
    const removeRes = await tagService.remove(item23.id);
    assert(removeRes.success && removeRes.id === item23.id);
    const find23 = await tagService.list({ match: [item23.id], count: true });
    assert(find23.list.length === 0 && find23.total === 0);
    const findAll = await tagService.list({ match: ['test-remove-%'], count: true });
    assert(findAll.total === 99);
  });
  it('bind tags', async () => {
    const tagService = new TagService({
      type: 'test-bind-instance'
    });
    await tagService.ready();
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test' + (i + 1),
        desc: 'desc test ' + (i + 1)
      });
    }
    const bindRes = await tagService.bind({
      objId: 1,
      tags: [1,23,45,78]
    });
    assert(bindRes.success);

    const bindRes2 = await tagService.bind({
      objId: 1,
      tags: [1,23,'xxx']
    });
    assert(!bindRes2.success && bindRes2.message === TAG_ERROR.NOT_EXISTS);
    // auto create
    const bindRes3 = await tagService.bind({
      objId: 1,
      tags: [1,23,'xxx'],
      autoCreateTag: true
    });
    assert(bindRes3.success);
    const tag = await tagService.list({ match: ['xxx']})
    assert(tag.list[0].name === 'xxx' && tag.list[0].id === 101);
  });

  it('list instanceId by tags', async () => {
    const tagService = new TagService({
      type: 'test-list-instance'
    });
    await tagService.ready();
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test' + (i + 1),
        desc: 'desc test ' + (i + 1)
      });
    }

    for(let i = 1; i <  10; i++) {
      for(let j = 1; j < 10; j ++) {
        await tagService.bind({
          objId: i,
          tags: [i * j]
        });
      }
    }
    const listRes = await tagService.listInstance({
      tags: [16],
      count: true
    });
    assert(listRes.list.length === 3 && listRes.total === 3);
    assert(listRes.list[0] === 2 && listRes.list[1] === 4 && listRes.list[2] === 8);
 
    // instanceid = 4/8 
    const listRes2 = await tagService.listInstance({
      tags: [16, 32],
      count: true
    });
    assert(listRes2.list.length === 2 && listRes2.total === 2);
    assert(listRes2.list[0] === 4 && listRes2.list[1] === 8);

    // remove tag 16
    await tagService.remove(16);
    const listResAfterRemove16 = await tagService.listInstance({
      tags: [16],
      count: true
    });
    assert(listResAfterRemove16.list.length === 0 && listResAfterRemove16.total === 0);
  });

  it('unbind & listInstanTags', async () => {
    const tagService = new TagService({
      type: 'test-list-unbind'
    });
    await tagService.ready();
    for(let i = 0; i < 100; i++) {
      await tagService.new({
        name: 'test' + (i + 1),
        desc: 'desc test ' + (i + 1)
      });
    }
    await tagService.bind({
      objId: 123,
      tags: [1,2,3,4]
    });
    const { list, total  } = await tagService.listInstanceTags({
      objId: 123,
      count: true
    });
    assert(list.length === 4 && total === 4);
    assert(list[1].id === 2 && list[2].id === 3 )
    await tagService.unbind({
      objId: 123,
      tags: [3, 1],
    });
    const afterUnbind = await tagService.listInstanceTags({
      objId: 123,
      count: true
    });
    assert(afterUnbind.list.length === 2 && afterUnbind.total === 2);
    assert(afterUnbind.list[0].id === 2 && afterUnbind.list[1].id === 4 )
  });
});