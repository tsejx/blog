---
title: 前端开发登录鉴权方案完全梳理
date: '2020-06-25'
description: 认证、授权、鉴权、权限控制，前端实现方案干货整理，助你深入了解登录背后原理
---

登录鉴权是互联网信息交互中永恒的话题，毕竟在工作中几乎每天都会接触到，适逢最近需要对现有的系统平台进行 SSO 的流程改造，所以趁这个机会好好总结前端工程师接触到的登录方式。

鉴权也叫身份验证（Authentication），是指验证用户是否拥有访问系统的权利。在日常的生活中，身份验证随处可见，比如：进入高铁站候车室、机场候机楼需要检查票据和身份证件；游玩主题乐园、名胜风景区需要购买门票，并由入口处人员鉴定有效后方可拥有进入园区游玩的权利。

而在计算机领域中，身份验证的方法有很多种：基于共享密钥的身份验证、基于生物学特征的身份验证和基于公开密钥加密算法的身份验证。不同的身份验证方法，安全性也各自不同。

下面我将从前端开发工程师的角度出发，梳理 Web 应用前后端数据交互中的各种鉴权方案。

以下为本文大纲：

- HTTP 基本认证
- Session-Cookie 认证
  - koa-session
- Token 认证
  - JWT 认证
  - koa-jwt
- OAuth2 开放授权
- SSO 单点登录
- LDAP 认证登录
- 扫码登录
- 联合登录
- 信任登录
- 易混淆概念分析

## HTTP 基本认证

在 HTTP 中，基本认证方案（Basic Access Authentication）是允许 HTTP 用户代理（通常指的就是网页浏览器）在请求时，通过用户提供用户名和密码的方式，实现对用户身份的验证。

基本认证中，最关键的是四个要素：

1. `uid`：用户的 ID，也就是我们常说的用户名
2. `password`：密码
3. `realm`：领域，其实就是指当前认证的保护范围

在进行基本认证的过程中，HTTP 的请求头字段会包含 Authorization 字段，`Authorization: Basic <用户凭证>`，该用户凭证是 `用户名` 和 `密码` 的组合而成的 **Base64 编码**。

```
GET /securefiles/ HTTP/1.1
Host: www.example.com
Authorization: Basic aHR0cHdhdGNoOmY=
```

![HTTP 基本认证流程图](http://img.mrsingsing.com/authentication-http-basic-access-authentication.jpg)

1. 用户在浏览器中访问了受限制的网页资源，但是没有提供用户的身份信息
2. 服务端接收到请求后返回 401 应答码（Unauthorized，未被授权的）要求进行身份验证，并附带提供了一个认证域（Access Authentication）`WWW-Authenticate` 说明如何进行验证的方法，例如 `WWW-Authenticate: Basic realm="Secure Area"`，`Basic` 就是验证的模式，而 `realm="Secure Area"` 则为保护域（告知认证的范围），用于与其他请求 URI 作区别
3. 浏览器收到应答后，会显示该认证域给用户并提示输入用户名和密码，此时用户可以选择录入信息后确定或取消操作
4. 用户输入了用户名和密码后，浏览器会在原请求头新增认证消息字段 `Authorization` 并重新发送请求，过程如下：

- 将用户名和密码拼接为 `用户名:密码` 格式的字符串
- 如果服务器 `WWW-Authenticate` 字段有指定编码，则将字符串编译成对应的编码
- 将字符串编码为 Base64
- 拼接 `Basic`，设置为 `Authorization` 字段，假设用户名为 `admin`，密码为 `password`，则拼接后为 `admin:password`，使用 Base64 编码后为 `YWRtaW46cGFzc3dvcmQ=`，那么最终在 HTTP 头部里会是这样：`Authorization: Basic YWRtaW46cGFzc3dvcmQ=`

```js
Buffer.from('admin:password').toString('base64');
// YWRtaW46cGFzc3dvcmQ=
```

5. 服务端接收了该认证后并返回了用户请求的网页资源。如果用户凭证非法或无效，服务器可能会再次返回 401 应答码，客户端就需要再次输入用户名和密码

服务端验证的步骤：

1. 根据用户请求资源的地址，确定资源对应的 `realm`
2. 解析 Authorization 请求首部，获得用户名和密码
3. 判断用户是否有访问该 `realm` 的权限
4. 验证用户名、密码是否匹配

> 当然，也有可能在首次请求中，在请求头附带了认证消息头，那么就不需要再作身份信息的录入步骤

优点：

- 唯一的优点是实现简单，被广泛支持

缺点：

- 由于用户名和密码是以明文的形式在网络中进行传输，容易被嗅探器探测到，所以基本验证方案并不安全
- 除此之外，Base64 编码并非加密算法，其无法保证安全与隐私，这里仅用于将用户名和密码中的不兼容的字符转换为均与 HTTP 协议兼容的字符集
- 即使认证内容无法被解码为原始的用户名和密码也是不安全的，恶意用户可以再获取了认证内容后使用其不断的享服务器发起请求，这就是所谓的重放攻击
- 该方案除了存在安全缺陷外，Basic 认证还存在无法吊销认证的情况

> HTTP 的基本验证方案应与 HTTPS / TLS 协议搭配使用。加入没有这些安全方面的增强，那么基本验证方案不应该被用来保护敏感或者极具价值的信息。

应用场景：内部网络，或者对安全要求不是很高的网络

## Session-Cookie 认证

`Session-Cookie` 认证是利用服务端的 Session（会话）和浏览器（客户端）的 Cookie 来实现的前后端通信认证模式。

由于 HTTP 请求时是无状态的，服务端正常情况下无法得知请求发送者的身份，这个时候我们如果要记录状态，就需要在服务端创建 Session 会话，将相同客户端的请求都维护在各自的会话记录中，每当请求到达服务端时，先校验请求中的用户标识是否存在于 Session 中，如果有则表示已经认证成功，否则表示认证失败。

Cookie 主要用于以下三个方面：

- 会话状态管理（如用户登录状态、购物车、游戏分数或其他需要记录的信息）
- 个性化设置（如用户自定义设置、主题等）
- 浏览器行为追踪（如跟踪分析用户行为等）

下图为 Session-Cookie 认证的工作流程图：

![Session-Cookie 认证流程图](http://img.mrsingsing.com/authentication-session-cookie.jpg)

1. 服务端在接收到来自客户端的首次访问时，会自动创建 Session（将 Session 保存在内存中，也可以保存在 Redis 中），然后给这个 Session 生成一个唯一的标识字符串会话身份凭证 `session_id`（通常称为 `sid`），并在响应头 `Set-Cookie` 中设置这个唯一标识符
2. 签名，对 `sid` 进行加密处理，服务端会根据这个 `secret` 密钥进行解密（非必需步骤）
3. 浏览器收到请求响应后会解析响应头，并自动将 `sid` 保存在本地 Cookie 中，浏览器在下次 HTTP 请求时请求头会自动附带上该域名下的 Cookie 信息
4. 服务端在接收客户端请求时会去解析请求头 Cookie 中的 `sid`，然后根据这个 `sid` 去找服务端保存的该客户端的 `sid`，然后判断该请求是否合法
5. 一旦用户登出，服务端和浏览器将会同时销毁各自保存的会话 ID，服务端会根据数据库验证会话身份凭证，如果验证通过，则继续处理

> ⚠️ 注意，这里相对于使用服务端，在另一端我使用了 `浏览器` 而非客户端，主要是因为 Cookie 是仅在浏览器中存在的报文字段，诸如移动原生 APP 是无法解析存储 Cookie 请求/响应头的。

优点：

1. Cookie 简单易用，在不受用户干预或过期处理的情况下，Cookie 通常是客户端上持续时间最长的数据保留形式
2. Session 数据存储在服务端，相较于 JWT 方便进行管理，也就是当用户登录和主动注销，只需要添加删除对应的 Session 就可以了，方便管理

缺点：

1. 非常不安全，Cookie 将数据暴露在浏览器中，增加了数据被盗的风险（容易被 CSRF 等攻击）
2. Session 存储在服务端，增大了服务端的开销，用户量大的时候会大大降低服务器性能
3. 用户认证后，服务端做认证记录，如果认证的记录被保存在内存中，这意味着用户下次请求还必须要请求在这台服务器上，这样才能拿到授权资源，这样在分布式的应用上，相应的限制了负载均衡的能力，也意味着限制了应用的扩展能力

### koa-session

没有代码谈再多都是空中楼阁，下面尝试在 Koa 中使用 `koa-session2` 中间件实现 Session-Cookie 这种鉴权方式。

在实际项目中，与客户端的会话信息往往需要在服务外再设立额外的外部存储机制，外部存储可以是任何的存储机制，例如内存数据结构，也可以是本地的文件系统，或是使用诸如 Redis 等 NoSQL 数据库。

`koa-session2` 自身实现的存储方式为保存在内存中的，而下面我们就介绍一种拓展 `koa-session2` 结合 Redis 实现 Session-Cookie 认证方式的方案：

```js
const Redis = require('ioredis');
const { Store } = require('koa-session2');

class RedisStore extends Store {
  constructor() {
    super();
    // 初始化 Redis
    this.redis = new Redis();
  }

  // 根据 sid 获取用户信息
  async get(sid, ctx) {
    let data = await this.redis.get(`SESSION: ${sid}`);
    return JSON.parse(data);
  }

  // 更新 sid 的用户信息
  async set(session, { sid = this.getID(24), maxAge = 1000000 } = {}, ctx) {
    try {
      await this.redis.set(`SESSION: ${sid}`, JSON.stringfy(session));
    } catch (e) {}

    return sid;
  }

  // 销毁会话信息
  async destroy(sid, ctx) {
    return await this.redis.del(`SESSION: ${sid}`);
  }
}

module.exports = RedisStore;
```

```js
// app.js
const Koa = require('koa');
const session = require('koa-session2');
const Store = require('./Store.js');

const app = new Koa();

app.use(
  session({
    // 种下 Cookie 的键名
    key: 'SESSIONID',
    // 禁止浏览器中 JS 脚本修改 Cookie
    httpOnly: true,
    // Cookie 加密签名机制
    signed: true,
    store: new Store(),
  })
);

app.use(ctx => {
  // Ignore favicon.ico
  if (ctx.path === '/favicon.ico') return;

  let user = this.session.user;

  ctx.session.view = 'index';
});

app.use(ctx => {
  // 如果设置了会话有效期刷新会话有效期
  ctx.session.refresh();
});
```

在 `koa-session` 中会话标识的实现仅是根据时间戳生成的随机字符串，如果担心 Cookie 传输中被恶意篡改或暴露信息，可以通过加入更多标识元素，例如 IP 地址、设备 ID 等。

Koa 的 Cookie 实现默认带了安全机制，就是 `signed` 选项为 `true` 时，会自动给 Cookie 添加一个 SHA256 的签名，类似 `koa:sess=pjadZtLAVtiO6-Haw1vnZZWrRm8`，从而防止 Cookie 被篡改。

至于担心的 Session 信息泄漏问题，`koa-session` 允许用户自定义编解码方法，例如：

```js
const encode = json => CrytoJS.AES.encrypt(json, 'Secret Passphrase');

const decode = encrypted => CryptoJS.AES.decrypt(encrypted, 'Secret Passphrase');
```

`koa-session` 为 Koa 官方实现的中间件，功能强大，考虑的情况比较多，所以实现相对复杂。

而 `koa-session2` 是社区实现的中间件，简洁易用。如果对实现有兴趣的同学可以在 Github 找到源码阅读。

- [koa-session](https://github.com/koajs/session)
- [koa-session2](https://github.com/Secbone/koa-session2)
- [koa-session 学习笔记](https://segmentfault.com/a/1190000013039187)
- [koa-session 的内部实现](https://www.jianshu.com/p/c1eff1b50d23)
- [从 koa-session 源码解读 session 原理](https://juejin.im/post/5c148fd551882530544f341f)
- [从 koa-session 中间件源码学习 cookie 与 session](https://segmentfault.com/a/1190000012412299)

## Token 认证

随着 Restful API、微服务的兴起，基于 Token 的认证现在已经越来越普遍。Token 和 Session-Cookie 认证方式中的 Session ID 不同，并非只是一个标识符。Token 一般会包含 `用户的相关信息`，通过验证 Token 不仅可以完成身份校验，还可以获取预设的信息。像 Twitter、微信、QQ、Github 等公有 API 都是基于这种方式进行认证的，一些开发框架如 OpenStack、Kubernetes 内部 API 调用也是基于 Token 的认证。

![Token 认证流程图](http://img.mrsingsing.com/authentication-token-authencation.jpg)

基于 Token 的身份验证方法：

1. 用户输入登录信息并请求登录
2. 服务端收到请求，验证用户输入的登录信息
3. 验证成功后，服务端会 `签发`一个 Token（通常包含用户基础信息、权限范围和有效时间等），并把这个 Token 返回给客户端
4. 客户端收到 Token 后需要把它存储起来，比如放在 localStorage 或 sessionStorage 里（一般不放 Cookie 因为可能会有跨域问题，以及安全性问题）
5. 后续客户端每次向服务端请求资源的时候，将 Token 附带于 HTTP 请求头 Authorization 字段中发送请求
6. 服务端收到请求后，去校验客户端请求中 Token，如果验证成功，就向客户端返回请求的数据，否则拒绝返还

优点：

- **服务端无状态**：Token 机制在服务端不需要存储会话（Session）信息，因为 Token 自身包含了其所标识用户的相关信息，这有利于在多个服务间共享用户状态
- **性能相对较好**：因为在验证 Token 时不用再去访问数据库或远程服务进行权限校验，自然可以提升不少性能
- 支持移动设备
- 支持跨域跨程序调用，因为 Cookie 是不允许跨域访问的，而 Token 则不存在这个问题
- 有效避免 CSRF 攻击（因为不需要 Cookie），但是会存在 XSS 攻击中被盗的风险，但是可选择 Token 存储在标记为 `httpOnly` 的 Cookie 中，能够有效避免浏览器中的 JS 脚本对 Cookie 的修改

缺点：

- 占带宽：正常情况下比 `sid` 更大，消耗更多流量，挤占更多宽带
- 性能问题：相比较于 Session-Cookie 认证来说，Token 需要服务端花费更多时间和性能来对 Token 进行解密验证，其实 Token 相较于 Session—Cookie 来说就是一个时间换空间的方案

> Session-Cookie 认证和 Token 认证的比较

Session-Cookie 认证和 Token 认证有很多类似的地方，但是 Token 认证更像是 Session-Cookie 认证的升级改良版。

Session-Cookie 认证仅仅靠的是 `sid` 这个生成的唯一标识符，服务端需要根据客户端传来的 `sid` 查询保存在服务端 Session 里保存的登录状态，当存储的信息数据量超过一定量时会影响服务端的处理效能。而且 Session-Cookie 认证需要靠浏览器的 Cookie 机制实现，如果遇到原生 NativeAPP 时这种机制就不起作用了，或是浏览器的 Cookie 存储功能被禁用，也是无法使用该认证机制实现鉴权的。

而 Token 认证机制特别的是，实质上登录状态是用户登录后存放在客户端的，服务端不会充当保存 `用户信息凭证` 的角色，当每次客户端请求时附带该凭证，只要服务端根据定义的规则校验是否匹配和合法即可，客户端存储的手段也不限于 Cookie，可以使用 Web Storage 等其他缓存方式。简单来说，Session-Cookie 机制限制了客户端的类型，而 Token 验证机制丰富了客户端类型。

除此之外，Token 验证比较灵活，除了常见的 JWT 外，可以基于 Token 构建专门用于鉴权的微服务，用它向多个服务的请求进行统一鉴权。

### JWT 认证

JWT（JSON Web Token）是 Auth0 提出的通过对 JSON 进行加密签名来实现授权验证的方案，就是登录成功后将相关信息组成 JSON 对象，然后对这个对象进行某种方式的加密，返回给客户端，客户端在下次请求时带上这个 Token，服务端再收到请求时校验 token 合法性，其实也就是在校验请求的合法性。

JWT 是 JSON 格式的被加密了的字符串：

```
JSON Data + Signature = JWT
```

JWT 对象通常由三部分组成：

1. 头部（Headers）：包括类别（typ）、加密算法（alg）

头部用于描述关于该 JWT 的最基本的信息，例如其类型以及签名所用的算法等。

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

这里我们说明了这是一个 JWT，并且我们所使用的签名算法是 HS256 算法。

2. Claims：包括需要传递的用户信息

载荷可以用来存放一些不敏感的信息

```json
{
  "iss": "Jehoshaphat Tse",
  "iat": 1441593502,
  "exp": 1441594722,
  "aud": "www.example.com",
  "sub": "mrsingsing@example.com",
  "name": "John Doe",
  "admin": true
}
```

这里面的前五个字段都是由 JWT 的标准所定义的:

- `iss`：该 JWT 的签发者
- `sub`：该 JWT 所面向的用户
- `aud`：接收该 JWT 的一方
- `exp`（expires）：什么时候过期，这是 Unix 时间戳
- `iat`（issued at）：在什么时候签发的。把头部和载荷分别进行 Base64 编码后得到两个字符串，然后再将这两个编码后的字符串用英文句号连接起来（头部在前），形成新的字符

3. Signature：

最后，将上述拼接后的字符串，用 `alg` 指定的算法（HS256）与私有密钥（Secret）进行加密。加密后的内容也是字符串，最后这个字符串就是签名，把这个签名拼接在刚才的字符串后面就能得到完整的 JWT。Header 部分和 Claims 部分如果被篡改，由于篡改者不知道密钥是什么，也无法生成新的 Signature 部分，服务端也就无法通过，在 JWT 中，消息体是透明的，使用签名可以保证消息不被篡改。

```js
HMACSHA256(base64UrlEncode(Headers) + '.' + base64UrlEncode(Claims), SECREATE_KEY);
```

优点：

1. 不需要在服务端保存会话信息（RESTful API 的原则之一就是无状态），所以易于应用的扩展，即信息不保存在服务端，不会存在 Session 扩展不方便的情况
2. JWT 中的载荷可以存储常用信息，用于信息交换，有效地使用 JWT，可以降低服务端查询数据库的次数

缺点：

1. **过期时间问题**：由于服务端不保存 Session 状态，因此无法在使用过程中废止某个 Token，或是更改 Token 的权限。也就是说，一旦 JWT 签发，在到期之前就会始终有效，除非服务端部署额外的逻辑。因此如果是浏览器端应用的话，使用 JWT 认证机制还需要设计一套 JWT 的主动更新删除的机制，这样就增加了系统的复杂性。
2. **安全性**：由于 JWT 的 Claims 是 Base64 编码的，并没有加密，因此 JWT 中不能存储敏感数据
3. **性能问题**：JWT 占用空间过大，Cookie 限制一般是 4k，可能会无法容纳，所以 JWT 一般放 LocalStorage 里面，并且用户在系统的每次 HTTP 请求都会把 JWT 携带在 Header 里面，HTTP 请求的 Header 可能比 Body 还要大。

### koa-jwt

下面介绍 Koa 中使用 `koa-jwt` 进行颁发、校验 Token 的使用方法。

服务端生成 Token

```js
const router = require('koa-router')();
const jwt = require('koa-jwt');
// 这里使用的是 MongoDB 数据库
const userModel = require('../model/userModel');

const secretOrPublicKey = 'TOKEN_EXAMPLE';

router.post('/login', async ctx => {
  const data = ctx.request.body;

  // 根据用户提供的用户名和密码查询数据库中是否存在对应的用户信息
  const userInfo = await userModel.findOne({ name: data.name, password: data.password });

  let result = null;
  if (userInfo !== null) {
    // 根据用户信息签发 Token，设定有效时间为 2h
    const token = jwt.sign({ name: userInfo.name, _id: userInfo._id }, secretOrPublicKey, {
      expiresIn: '2h',
    });

    result = {
      code: 200,
      token: token,
      msg: '登录成功',
    };
  } else {
    result = {
      code: 400,
      token: null,
      msg: '登录失败',
    };
  }

  return (ctx.body = result);
});
```

前端获取 Token：

```js
// 请求登录
function login(userName, password) {
  return axios
    .post('/login', {
      name: userName,
      password: password,
    })
    .then(res => {
      if (res.code === 200) {
        localStorage.setItem('access_token', res.data.token);
      } else {
        console.log('登录失败');
      }
    })
    .catch(e => console.error(e));
}

// 后续获取 Token 后续的 API 请求
// 通过 Axios 拦截器加上 Authorization 请求头部字段
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');

  config.headers.common['Authorization'] = 'Bearer ' + token;

  return config;
});
```

服务端校验前端发送来的请求：

```js
const koa = require('koa');
const jwt = require('koa-jwt');
const app = new Koa();
const secretOrPublicKey = 'TOKEN_EXAMPLE';

app
  .use(
    jwt({
      secret: secretOrPublicKey,
    })
  )
  .unless({
    path: [/\register/, /\/login/],
  });
```

在 `koa-jwt` 的源码实现中，我们可以知道 Token 的鉴定是先判断请求头中是否带了 Authorization：

- 有，则通过正则将 `token` 从 Authorization 中分离出来，Token 中是带有 Bearer 这个单词
- 没有，则代表了客户端没有传 Token 到服务器，这时候就抛出 401 错误状态

源码文件中的 `verify.js` 中，调用了 `jsonwebtoken` 库原生提供的 `verify()` 方法进行验证返回结果。

[jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) 的 `sign()` 用于生成 `token`，而 `verify()` 方法当然则是用来解析 `token`。属于 JWT 配对生产的两个方法，所以 `koa-jwt` 这个中间件也没做什么事，无非就是用正则解析请求头，调用 `jsonwebtoken` 的 `verify()` 验证 `token`，在 `koa-jwt` 文件夹的 `index.js` 中，`koa-jwt` 还调用 `koa-unless` 进行路由权限分发。

- [Koa2 服务端使用 JWT 进行鉴权及路由权限分发的流程分析](http://www.uxys.com/html/JavaScript/20190722/52733.html)

### Token 认证常见问题及解决方案

#### 注销登录

注销登录等场景下 Token 仍有效类似的场景：

- 退出登录
- 修改密码
- 服务端修改了某个用户具有的权限或角色
- 用户的账户被删除/暂停
- 用户由管理员注销

这个问题仅存在于 Token 认证中，因为 Session-Cookie 认证模式中，这些情况能够通过删除服务端 Session 中对应的记录解决，而 Token 认证中，如果服务端不增加其他逻辑的话，在失效前 Token 都是有效的。

下面列出几种针对这些场景的解决方案：

- **将 Token 存储在内存数据库**：将 Token 存入类似于 Redis 的内存数据库中。如果需要让某个 Token 失效就直接从 Redis 中删除这个 Token 即可。但是这样会导致每次使用 Token 发送请求都要先从 DB 中查询 Token 是否存在的步骤，而且违背了 JWT 无状态原则。
- **黑名单机制**：和上述方案类似，使用内存数据库维护一份黑名单，如果想让某个 Token 失效的话就直接将这个 Token 放入到黑名单内即可。每次使用 Token 进行请求时都会先判断 Token 是否存在于黑名单中。
- **修改密钥 Secret**：为每个用户创建专属密钥，如果想让某个 Token 失效，我们直接修改对应用户的密钥即可。但是，这样相较于前两种引入内存数据带入的危害更大：
  - 如果服务是分布式的，每次发出新的 Token 时都必须在多台及其同步密钥。为此，你需要将机密存在数据库或其他外部服务中，这样和 Session 认证就没有太大区别了
  - 如果用户同时在两个浏览器打开系统，或者在移动设备上打开系统，当它从一个地方将账号退出时，那么其他终端都需要重新登录认证，这是不可取的
- **保持令牌的有效期限短并经常轮换**
  - 很简单的方式，但是会导致用户登录状态不会被持久记录，而且需要用户经常登录

#### 续签问题

Token 的续签问题：

Token 有效期一般不建议设置过长，而 Token 过期后如何认证，如何 `动态刷新` Token 等需要有效的方案解决。

在 Session-Cookie 认证中，假设 Session 有效期为 30 分钟，如果 30 分钟内有资源请求访问，那么就把 Session 的有效期自动延长 30 分钟。

- **类似于 Session 人中的做法**：当客户端访问服务端，发现 Token 即将过期时，服务端重新颁发新的 Token 给客户端
- **每次请求都返回新 Token**：实现思路简单明了，但是开销较大
- **Token 有效期设置到半夜**：折衷方案，保证大部分用户正常工作时间可以正常登录，适用于安全性要求不高的系统
- **用户登录返回两个 Token**：第一个是 `accessToken`，它的过期时间设置比如半个小时，另一个是 `refreshToken`，它的过期时间更长一点，例如 1 天。客户端登录后，将 `accessToken` 和 `refreshToken` 保存在本地，每次访问将 `accessToken` 传给服务端。服务端校验 `accessToken` 的有效性，如果过期的话，就将 `refreshToken` 传给服务端。如果有效，服务端就生成新的 `accessToken` 给客户端。否则，客户端就重新登录即可。该方案不足的是：
  - 需要客户端配合
  - 用户注销的时候需要同时保证两个 Token 都无效
  - 重新请求获取 Token 的过程中会有短暂 Token 不可用的情况（可以通过在客户端设置定时器，当 `accessToken` 快过期的时候，提前去通过 `refreshToken` 获取新的 `accessToken`）

JWT 最适合的场景是不需要服务端保存用户状态的场景，如果考虑到 Token 注销和续签等场景的话，目前来说没有特别好的解决方案，大部分解决方案都给 Token 加上状态，这实际上就有点类似 Session-Cookie 认证了。

## 单点登录

**单点登录**（Single Sign-on）又称 SSO，是指在多系统应用群中登录单个系统，便可在其他所有系统中得到授权而无需再次登录。

传统的 All-in-one 型应用的认证系统和业务系统集合在一起的，当用户认证通过时，将用户信息存入 Session 中。其他业务只需要从业务中通过对应会话身份凭证取到用户信息进行相关业务处理即可。

传统的 Session 是将用户信息存入内存，维护一个哈希表。每次请求携带会话身份凭证 SessionID（Tomcat 中是 `JSESSIONID`）到服务端，根据此 SessionID 查找到对应的用户信息。

利用 Redis 等内存数据库进行用户信息的存储，自定义 Token 生成规则将用户信息写入 Redis 中。这样将用户信息的存储和业务系统进行拆分，使系统更加健壮，更易于扩展。新增系统只需要从 SSO 中获取相关的认证即可进行横向的业务扩展。而且 Redis 本身的性质也易于进行 `集群化` 的部署。

下面详述各种场景下 SSO 的实现方案。

### 同域 SSO

当存在两个相同域名下的系统 A `a.abc.com` 和系统 B `b.abc.com` 时，以下为他们实现 SSO 的步骤：

1. 用户访问某个子系统时（例如 `a.abc.com`），如果没有登录，则跳转至 SSO 认证中心提供的登录页面进行登录
2. 登录认证后，服务端把登录用户的信息存储于 Session 中，并为用户生成对应的会话身份凭证附加在响应头的 `Set-Cookie` 字段中，随着请求返回写入浏览器中，并回跳到设定的子系统链接中
3. 下次发送请求时，当用户访问同域名的系统 B 时，由于 A 和 B 在相同域名下，也是 `abc.com`，浏览器会自动带上之前的 Cookie。此时服务端就可以通过该 Cookie 来验证登录状态了。

这实际上使用的就是 Session-Cookie 认证的登录方式。

### 跨域 SSO

上述所提及的同域名 SSO 并不支持跨域名的登录认证，这显然不符合当今互联网发展潮流，毕竟大多数中大型企业内外部的系统都是部署在不同的域名下，下面我们介绍实现单点登录的标准流程。

**CAS**（Central Authentication Service）中央授权服务，本身是一个开源协议，分为 1.0 版本和 2.0 版本。1.0 称为基础模式，2.0 称为代理模式，适用于存在非 Web 应用之间的单点登录。

CAS 的实现需要三方角色：

- Client：用户
- Server：中央授权服务，也是 SSO 中心负责单点登录的服务器
- Service：需要使用单点登录鉴权的各个业务服务，相当于上文中的系统 A / B

CAS 的实现需要提供以下四个接口：

- `/login`：登录接口，用于登录到中央授权服务
- `/logout`：登出接口，用于从中央授权服务中登出
- `/validate`：用于验证用户是否登录中央授权服务
- `/serviceValidate`：用于让各个 Service 验证用户是否登录中央授权服务

CAS 票据：

- **TGT（Ticket Grangting Ticket）**：TGT 是 CAS 为用户签发的 `登录票据`，拥有了 TGT，用户就可以证明自己在 CAS 成功登录过。TGT 封装了 Cookie 值以及此 Cookie 值对应的用户信息。当 HTTP 请求到来时，CAS 以此 Cookie 值（TGC）为 `key` 查询缓存中是否有 TGT，如果有，则表示用户已登录过。
- **TGC（Ticket Granting Cookie）**：CAS Service 生成 TGC 放入自己的 Session 中，而 TGC 就是这个 Session 的唯一标识（SessionID），以 Cookie 形式放到浏览器端，是 CAS Service 用来明确用户身份的凭证
- **ST（Service Ticket）**：ST 是 CAS 为用户签发的访问某个 Service 的票据。用户访问 Service 时，Service 发现用户没有 ST，则要求用户去 CAS 获取 ST。用户向 CAS 发出 ST 的请求，CAS 发现用户有 TGT，则签发一个 ST，返回给用户。用户拿着 ST 去访问 Service，Service 拿 ST 去 CAS 验证，验证通过后，允许用户访问资源。

这里可能概念太多会非常难理解，简单说明下，客户端需要各自维护与不同系统的登录状态，包括与中央授权服务的登录状态。所以，实际上 TGC 和 TGT 是维护客户端与中央授权服务登录状态的会话身份凭证的 `key-value` 键名值，而 ST 票据则是资源服务向中央授权服务获取用户登录状态、信息的交换凭证，只不过资源服务需要经用户的“手”上才能获取到该票据。

详细步骤：

![CAS 验证流程时序图](http://img.mrsingsing.com/authentication-cas-workflow.png)

1. 用户访问系统 A 的受保护资源（域名是 `a.abc.com`），系统 A 检测出用户处于 `未登录` 状态，重定向（应答码 302）至 SSO 服务认证中心的登录接口，同时地址参数携带登录成功后回跳到系统 A 的页面链接（跳转的链接形如 `sso.abc.com/login?service=https%3A%2F%2Fwww.a.abc.com`）
2. 由于请求没有携带 SSO 服务器上登录的票据凭证（TGC），所以 SSO 认证中心判定用户处于 `未登录` 状态，重定向用户页面至 SSO 的登录界面，用户在 SSO 的登录页面上进行登录操作。
3. SSO 认证中心校验用户身份，创建用户与 SSO 认证中心之间的会话，称为 `全局会话`，同时创建 `授权令牌`（ST），SSO 带着授权令牌跳转回最初的系统 A 的请求地址：

- 重定向地址为之前写在 `query` 中的系统 A 的页面地址
- 重定向地址的 `query` 中包含 SSO 服务器派发的 ST
- 重定向的 HTTP 响应中包含写 Cookie 的 Header。这个 Cookie 代表用户在 SSO 中的登录状态，它的值就是 TGC

5. 浏览器重定向至系统 A 服务地址，此时重定向的 URL 中携带着 SSO 服务器生成的 ST
6. 系统 A 拿着 ST 向 SSO 服务器发送请求，SSO 服务器验证票据的有效性。验证成功后，系统 A 知道用户已经在 SSO 登录了，于是系统 A 服务器使用该令牌创建与用户的会话，称为 `局部会话`，返回受保护网页资源
7. 之后用户访问系统 B 受保护资源（域名 `b.abc.com`），系统 B 检测出用户处于 `未登录` 状态，跳转至 SSO 服务认证中心，同时地址参数携带授权令牌 ST（每次生成的 ST 都是不一样的）登录成功后回跳的链接
8. SSO 认证中心发现用户已登录，跳转回系统 B 的地址，并附上令牌
9. 系统 B 拿到令牌，去 SSO 认证中心校验令牌是否有效，SSO 认证中心校验令牌，返回有效，注册系统 B
10. 系统 B 使用该令牌创建与用户的局部会话，返回受保护资源

至此整个登录流程结束，而在实际开发中，基本上都会根据 CAS 增加更多的判断逻辑，比如，在收到 CAS Server 签发的 ST 后，如果 ST 被 Hacker 窃取，并且 Client 本身没来得及去验证 ST，被 Hacker 抢先一步验证 ST，怎么解决。此时就可以在申请 ST 时添加额外验证因子（如 IP、SessionID 等）。

### LDAP 认证登录

LDAP 的全称是 Lightweight Directory Access Protocol，即**轻量目录访问协议**，是一个开放、广泛被使用的工业标准（IEFT、RFC）。企业级软件也通常具备 \*_支持 LDAP_- 的功能，比如 Jira、Confluence、OpenVPN 等，企业也经常采用 LDAP 服务器来作为企业的认证源和数据源。但是大家比较常见的误区是，可以使用 LDAP 来实现 SSO。我们可以先分析以下它的主要功能点或场景。

- 作为数据源它可以用于存储
  - 企业的组织架构树
  - 企业员工信息
  - 证书信息
  - 会议室，打印机等等资源
- 作为认证源，它也有多种用途
  - 存储用户的密码
  - 对外提供 LDAP 协议的认证方式（通过 LDAP BIND 协议来校验用户名和密码）
  - 密码策略（密码复杂度，历史密码记录，用户锁定等等）

## 信任登录

信任登录是指所有不需要用户主动参与的登录，例如建立在私有设备与用户之间的绑定关系，凭证就是私有设备的信息，此时不需要用户再提供额外的凭证。信任登录又指用第三方比较成熟的用户库来校验凭证，并登录当前访问的网站。

1. 登录服务 \*_信任业务系统_- 的凭证校验结果
2. 登录服务 \*_信任第三方登录系统_- 的凭证校验结果，前提是必须又本站点的账号体系下的账号与第三方账号的一对一绑定关系，现在流行的授权方式也属于这个模式。

目前比较常见的第三方信任登录帐号如：QQ 号淘宝帐号、支付宝帐号、微博帐号等。

信任登录的好处是可以利用第三方庞大的用户群来推广、营销网站，同时减少用户的注册、登录时间。

提到信任登录，我们就不得不提到 OAuth，正是有了 OAuth，我们的信任登录才得以实现。下面我们就来看下关于 OAuth 的一些介绍。

## OAuth2 开发授权

OAuth（开放授权）是一个开发标准，允许用户授权 `第三方网站` 访问他们存储在另外的服务提供商中的信息，而不需要接触到用户名和密码。为了保护数据的安全和隐私，第三方网站访问用户数据前都需要 `显式地向用户征求授权`。我们常见的 OAuth 认证服务的厂商有微信、QQ、支付宝等。

OAuth 协议又有 1.0 和 2.0 两个版本，2.0 版整个授权验证流程更简单更安全，也是目前最主要的用户身份验证和授权方式。

应用场景有：第三方应用的接入、微服务鉴权互信、接入第三方平台、第一方密码登录等。

授权模式：

- 授权码模式（Authorization Code Grant）
- 隐式授权模式（Implicit Grant）
- 密码模式（Resource Owner Password Credentials Grant）
- 客户端模式（Client Credentials Grant）

无论哪种授权模式，都必须拥有四种必要的角色参与：`客户端`、`授权服务器`、`资源服务器`，有的还有 `用户（资源拥有者）`。我们以微信开发平台的授权登录为例解释这四种角色：

- 资源拥有者（Resource Owner）：这里指微信用户
- 第三方应用（Third-party Application）：指内嵌在微信应用内的第三方应用，形式不限于 Web App、公众号 Web 网页、小程序等等
- 授权服务器（Authorization Server）：这里指微信开发平台的授权服务
- 资源服务器（Resource Server）：用于存储、获取用户资源，这里指的是微信开放平台的服务器

### 授权码模式

授权码模式是 OAuth 2.0 目前最安全最复杂的授权流程。

![授权码模式](http://img.mrsingsing.com/authentication-authorization-code-grant.jpg)

授权码模式的授权流程可以分为三个部分：

1. Client Side：用户+客户端与授权服务端的交互
2. Server Side：客户端与授权服务端之间的交互
3. Check Access Token'：客户端与资源服务端之间的交互 + 资源服务端与授权服务端之间的交互

整个流程就是：客户端换取授权码，客户端使用授权码换取 Token，客户端使用 Token 访问资源

> 前提条件：
>
> - 第三方客户端需要提前与资源拥有方（同时也是授权所有方）协商客户端 ID（client_id）以及客户端密钥（client_secret）
> - 上述流程暂未将 `scope`、`state` 等依赖具体框架的内容写进来，这里可以参考 Spring Security OAuth2 的实现

**Client Server 客户端换取授权码**

这个客户端可以是浏览器

1. 客户端将 `client_id + client_secret + 授权模式标识（grant_type）+ 回调地址（redirect_uri）` 拼接成 URL 访问授权服务器
2. 授权服务端返回登录界面，要求 `用户登录`（此时用户提交的账号密码等直接发送到授权服务端，进行校验）
3. 授权服务端返回授权审批界面，`用户授权` 完成
4. 授权服务端 `返回授权码到回调地址`

**Server Side 客户端使用授权码换取 Token**

1. 客户端接收到授权码，并使用 `授权码 + client_id + client_secret` 访问授权服务端颁发 Token 令牌
2. 授权服务端校验通过，颁发 Token 返回给客户端
3. 客户端保存 Token 到存储器

**Check Access Token 客户端使用 Token 访问资源**

1. 客户端在请求头带上 Token，访问资源服务端
2. 资源服务端收到请求后，先调用校验 Token 的方法（可以是远程调用授权服务端校验 Token，也可以直接访问授权存储器手动校验）
3. 资源服务端校验成功，返回资源

移动应用微信登录是基于 OAuth2.0 协议标准构建的微信 OAuth2.0 授权登录系统，在微信开放平台注册开发者账号，并拥有已审核通过的移动应用，并获得相应的 AppID 和 AppSecret，申请微信登录且通过审核后，可开始接入流程。

```
1. 第三方发起微信授权登录请求，微信用户允许授权第三方应用后，微信会拉起应用或重定向到第三方网站，并且带上授权临时票据 code 参数
2. 通过 code 参数加上 AppId 和 AppSecret 等，通过 API 换取 access_token
3. 通过 access_token 进行接口调用，获取用户基本数据资源或帮助用户实现基本操作
```

![微信 OAuth2.0 获取 access_token 时序图](http://img.mrsingsing.com/authentication-wx-oauth2-access-token.png)

详情可以参阅 [微信登录功能 - 移动应用微信登录开发指南](https://developers.weixin.qq.com/doc/oplatform/Mobile_App/WeChat_Login/Development_Guide.html)，这里的实现就是授权码模式。

### 隐式授权模式

![隐式授权模式流程图](http://img.mrsingsing.com/authentication-implicit-grant.jpg)

隐式授权模式大致可以分为两部分：

1. Client Side：用户+客户端与授权服务端的交互
2. Check Access Token：客户端与资源服务端之间的交互 + 资源服务端与授权服务端之间的交互

整个流程就是：客户端让用户登录授权服务端换取 Token，客户端使用 Token 访问资源

**Client Side 客户端让用户登录授权服务端换 Token**

1. 客户端（浏览器或单页应用）将 `client_id + 授权模式标识（grant_type）+ 回调地址（redirect_url）` 拼成 URL 访问授权服务端
2. 授权服务端跳转用户登录界面，用户登录
3. 用户授权
4. 授权服务端 `访问回调地址` 返回 Token 给客户端

**Check Access Token 客户端使用 Token 访问资源**

1. 客户端在请求头附带 Token 访问资源服务端
2. 资源服务端收到请求，先调用校验 Token 的方法（可以是远程调用授权服务端校验 Token，也可以直接访问授权存储器手动校验）
3. 资源服务端校验成功，返回资源

### 密码模式

![密码模式流程图](http://img.mrsingsing.com/authentication-resource-owner-password-credentials-grant.jpg)

密码模式的授权流程可以分为两部分：

1. Client Side：用户与客户端的交互，客户端与授权服务端的交互
2. Check Access Token'：客户端与资源服务端之间的交互 + 资源服务端与授权服务端之间的交互

整个流程就是：用户在客户端提交账号密码换取 Token，客户端使用 Token 访问资源

**Client Server 用户在客户端提交账号密码换取 Token**

1. 客户端要求用户登录
2. 用户输入密码，客户端将表单中添加客户端的 `client_id + client_secret` 发送给授权服务端颁发 Token 令牌
3. 授权服务端校验用户名、用户密码、`client_id` 和 `client_secret`，均通过后返回 Token 给客户端
4. 客户端保存 Token

**Check Access Token 客户端使用 Token 访问资源**

1. 客户端在请求头带上 Token，访问资源服务端
2. 资源服务端收到请求后，先调用校验 Token 的方法（可以是远程调用授权服务端校验 Token，也可以直接访问授权存储器手动校验）
3. 资源服务端校验成功，返回资源

### 客户端模式

![客户端模式流程图](http://img.mrsingsing.com/authentication-client-credentials-grant.jpg)

客户端模式的授权流程可以分为两部分：

1. Server Side：客户端与授权服务端之间的交互
2. Check Access Token'：客户端与资源服务端，资源服务端与授权服务端之间的交互

整个流程就是：客户端使用自己的标识换取 Token，客户端使用 Token 访问资源

**Client Server 客户端使用自己的标识换取 Token**

1. 客户端使用 `client_id + client_secret + 授权模式标识` 发送给授权服务端颁发 Token 令牌
2. 授权服务端校验通过后返回 Token 给客户端
3. 客户端保存 Token

**Check Access Token 客户端使用 Token 访问资源**

1. 客户端在请求头带上 Token，访问资源服务端
2. 资源服务端收到请求后，先调用校验 Token 的方法（可以是远程调用授权服务端校验 Token，也可以直接访问授权存储器手动校验）
3. 资源服务端校验成功，返回资源

### 授权模式选型

考虑到授权场景的多样性，可以参考以下两种选型方式：

- 按授权需要的多端情况
- 按客户端类型与所有者

按授权需要的多端情况：

| 模式                              | 需要前端 | 需要后端 | 需要用户响应 | 需要客户端密钥 |
| :-------------------------------- | :------- | :------- | :----------- | :------------- |
| 授权码模式 Authorization Code     | ✓        | ✓        | ✓            | ✓              |
| 隐式授权模式 Implicit Grant       | ✓        | ✗        | ✓            | ✗              |
| 密码授权模式 Password Grant       | ✓        | ✓        | ✓            | ✓              |
| 客户端授权模式 Client Credentials | ✗        | ✓        | ✗            | ✓              |

按照客户端类型与访问令牌所有者分类：

![OAuth2.0 模式选型](http://img.mrsingsing.com/authentication-oauth2-mode-selection.jpg)

## 联合登录

联合登录指同时包含多种凭证校验的登录服务，同时，也可以理解为使用第三方凭证进行校验的登录服务。这个概念有点像 OAuth2.0 的认证方式。

最经典的莫过于 APP 内嵌 H5 的使用场景，当用户从 APP 进入内嵌的 H5 时，我们希望 APP 内已登录的用户能够访问到 H5 内受限的资源，而未登录的用户则需要登录后访问。

这里思路主要有两种，一种是原生跳转内嵌 H5 页面时，将登录态 Token 附加在 URL 参数上，另一种则是内嵌 H5 主动通过与原生客户端制定的协议获取应用内的登录状态。

## 扫码登录

二维码也称为二维条码，是指在一维条码的基础上扩展出另一维具有可读性的条码，使用黑白矩形图案表示二进制数据，被设备扫描后可获取其中所包含的信息。一维条码的宽度记载着数据，而其长度没有记载数据。二维码的长度、宽度均记载着数据。二维码有一维条码没有的 **定位点\*- 和 **容错机制\*\*。容错机制在即使没有识别到全部的条码、或是说条码有污损时，也可以正确地还原条码上的信息。

扫码登录通常见于移动端 APP 中，基本操作流程是让已登录用户主动扫描二维码，以使 PC 端的同款应用得以快速登录的方式，常见的具备扫码登录的应用有微信、钉钉、支付宝等。

![扫码登录流程图](http://img.mrsingsing.com/authentication-scan-qrcode-login-workflow.jpg)

扫码登录可以分为三个阶段：待扫码、已扫码待确认和已确认。

### 待扫码阶段

**待扫码阶段**即上述流程图中 1~5 的阶段，亦即生成二维码阶段，这个阶段与移动端没有关系，主要是 PC 端与服务端进行交互的过程。

首先 PC 端携带设备信息向服务端发起了生成二维码请求，服务端接收到请求后生成 `UUID` 作为二维码 ID，并将 UUID 与 `PC 端的设备信息` 关联起来存储在 Redis 服务器中，然后返回给 PC 端。

当 PC 端收到二维码 ID 之后，将二维码 ID 以 `二维码的形式` 展示，等待移动端扫码。此时 PC 端开始轮询查询二维码状态，直到登录成功。当然除了使用轮询查询，也能使用 WebSocket 实现查询/推送二维码状态的需求。如果移动端未扫描，那么一段时间后二维码会自动失效。

### 已扫码待确认阶段

**已扫码待确认阶段**亦即流程图中的 6~10 的阶段，在 PC 端登录微信时，手机扫码后，PC 端的二维码会显示为已扫码，并提示需要在手机上确认，这个阶段是移动端与服务端交互的过程。

移动端扫描二维码后，会自动获取到二维码 ID，并将移动端登录的信息凭证（Token）和二维码 ID 作为参数发送给服务端，此时手机必须是已登录（使用扫描登录的前提是移动端的应用为已登录状态，这样才可以共享登录态）。

服务端接受请求后，会将 `Token 与二维码 ID` 关联，为什么需要关联呢？因为，当我们在使用微信时，移动端退出时，PC 端也应该随之退出登录，这个关联就起到这个作用。然后会生成一个一次性 Token，这个 Token 会返回给移动端，一次性 Token 用作确认时的凭证。

PC 端轮询到二维码的状态已经发生变化，会将 PC 端的二维码更新为已扫描，请确认。

### 已确认阶段

**已确认阶段**为流程图中的步骤 11~15，这是扫码登录的最后阶段，用户确认登录，移动端携带上一步中获取的 `临时 Token` 发送给服务端校验。服务端校验完成后，会更新二维码状态，并且给 PC 端生成一个 `正式的 Token`，后续 PC 端就是持有这个 Token 访问服务端。

PC 端的定时器，轮询到二维码状态为已登录状态，并且会获取到了生成的 Token，完成登录，后续访问都基于 Token 完成。

在服务端会跟移动端一样，维护着 Token 跟二维码、PC 设备信息、账号等信息。

## 一键登录

最传统的登录方式莫过于提供账号密码校验，但这毫无疑问需要消耗用户的记忆成本。随着无线互联的发展以及手机卡实名制的推广，手机号俨然已成为特别的身份证明，与账号密码相比，手机号可以更好地验证用户的身份，防止恶意注册。

但是手机号注册还是需要一系列繁琐的操作：输入手机号、等待短信验证码、输入验证码、点击登录。整个流程少说二十秒，而且如果收不到短信，也就登录补了，这类问题有可能导致潜在的用户流失。

短信验证码的作用就是证明当前操作页面的用户与输入手机号的用户为相同的人，那么实际上只要我们能够获取到当前手机的手机号并与输入的手机号对比匹配后便能达到校验的功能。但是，无论是原生 APP 还是 H5 网页都是不具备直接获取用户手机号的功能的，而这种需求运营商能够通过手机 SIM 卡的流量数据查询。随着运营商开放了相关的服务，我们能够接入运营商提供的 SDK 并付费使用相关的服务。

下图为一键登录的流程图：

![一键登录流程图](http://img.mrsingsing.com/authentication-one-click-login-workflow.png)

主要步骤：

1. SDK 初始化：调用 SDK 方法，传入平台配置的 AppKey 和 AppSecret
2. 唤起授权页：调用 SDK 唤起授权接口，SDK 会先向运营商发起获取手机号掩码的请求，请求成功后跳到授权页。授权页会显示手机号掩码以及运营商协议给用户确认。
3. 同意授权并登录：用户同意相关协议，点击授权页面的登录按钮，SDK 会请求本次取号的 Token，请求成功后将 Token 返回给客户端
4. 取号：将获取到的 Token 发送到自己的服务器，由服务端携带 Token 调用运营商一键登录的接口，调用陈工就返回手机号码。服务端用手机号进行登录或注册操作，返回操作结果给客户端，完成一键登录。

由于国内三大运营商各自有独立的 SDK，所以会导致兼容方面的工作会特别繁琐。如果要采用一键登录的方案，不妨采用第三方提供了号码认证服务，下列几家供应商都拥有手机号码认证能力：

- [阿里 - 号码认证服务](https://help.aliyun.com/product/75010.html)
- [创蓝 - 闪验](http://shanyan.253.com/)
- [极光 - 极光认证](https://www.jiguang.cn/identify)
- [mob - 秒验](https://www.mob.com/mobService/secverify)

在认证过程中，需要用户打开蜂窝网络，如果手机设备没有插入 SIM 卡、或者关闭蜂窝网络的情况下，是无法完成认证的。所以就算接入一键登录，还是要兼容传统的登录方式，允许用户在失败的情况下，仍能正常完成登录流程。

## 总结

鉴权授权是计算机领域无法躲避的技术议题，认证、授权、鉴权和权限控制是围绕这个议题的几个关键概念：认证（Identification）是指根据声明者提供的资料，确认声明者身份；授权（Authorization）则是资源所有者委派执行者，赋予执行者指定范围的资源操作权限，以便执行者代理执行对资源的相关操作；鉴权（Authentication）指的对声明者所声明的真实性进行校验。从授权角度出发，会更加容易理解鉴权。授权和鉴权是两个上下游相匹配的关系，先授权，后鉴权。

- Authorization 决定你是否有权限去获取资源
- Authentication 校验你说你是谁

```
授权 -> 鉴权 -> 权限控制
```

花了一周时间将登录鉴权授权方面的知识总结了一番，确认对各种方案的实施细节，以及设计原理、方案优劣都有了更深一层的了解，在学习的过程中不免会联想到无论是生活中各种类似的场景，也会想到计算机领域中诸如 Linux 系统、数据库等权限控制相关机制。这是个融汇贯通的学习过程，发现这种针对某个议题的体系式整理，对前端技术体系中各个独立的点连通起到了不错的效果。

---

**参考资料：**

- [📖 Wikipedia：Basic Access Authentication](https://en.wikipedia.org/wiki/Basic_access_authentication)
- [📖 HTTP 身份验证 Authentication](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Authentication)
- [📖 RFC 7019 - JSON Web Token（JWT）](https://tools.ietf.org/html/rfc7519)
- [📖 CAS 官方文档](https://apereo.github.io/cas/4.2.x/index.html)
- [📝 一文读懂 HTTP Basic 身份认证](https://juejin.im/entry/5ac175baf265da239e4e3999)
- [📝 你在用 JWT 代替 Session？](https://zhuanlan.zhihu.com/p/43527568)
- [📝 用户认证：基于 JWT 和 Session 的区别和优缺点](https://juejin.im/post/5cefad23e51d4510774a87f4#heading-4)
- [📝 JWT 身份认证优缺点分析以及常见问题解决方案](https://zhuanlan.zhihu.com/p/85873228)
- [📝 前端需要了解的 SSO 与 CAS 知识](https://juejin.im/post/5a002b536fb9a045132a1727)
- [📝 不务正业的前端之 SSO（单点登录）实践](https://juejin.im/post/5b51f39b5188251a9f24a264)
- [📝 面试题：给我说一下你项目中的单点登录是如何实现的](https://zhuanlan.zhihu.com/p/102898335)
- [📝 单点登录系统](https://zhuanlan.zhihu.com/p/60376970)
- [📝 单点登录原理与简单实现](https://www.cnblogs.com/ywlaker/p/6113927.html)
- [📝 单点登录 LDAP 协议](https://zhuanlan.zhihu.com/p/92263756)
- [📝 信任登录与联合登录有什么差异？](https://www.zhihu.com/question/21387523)
- [📝 OAuth2.0 深入了解：以微信开发平台统一登录为例](https://juejin.im/entry/5a93506e6fb9a0634c268da8)
- [📝 OAuth 2.0 概念及授权流程梳理](https://www.cnblogs.com/hellxz/p/oauth2_process.html)
- [📝 论 H5 嵌入 APP 的联合登录的解决方案](https://juejin.im/post/5d15d3336fb9a07efb69994f)
- [📝 聊一聊二维码扫描登录原理](https://juejin.im/post/5e83e716e51d4546c27bb559)
- [📝 阿里面试官：分别说说微信和淘宝扫码登录背后的实现原理](https://mp.weixin.qq.com/s/gA0JQp4j2ym9qOyQkC3qkA)
- [📝 用户一键登录，如何实现](https://juejin.im/post/5d197adff265da1bb31c4fa9)
- [📝 微服务架构下的鉴权，怎么做更优雅？](https://learnku.com/articles/30704)
- [📝 认证、授权、鉴权和权限控制](http://www.hyhblog.cn/2018/04/25/user_login_auth_terms/)