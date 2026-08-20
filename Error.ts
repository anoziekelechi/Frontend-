 Traceback (most recent call last):
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 526, in _prepare_and_execute
backend-1   |     prepared_stmt, attributes = await adapt_connection._prepare(
backend-1   |                                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 773, in _prepare
backend-1   |     prepared_stmt = await self._connection.prepare(
backend-1   |                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/asyncpg/connection.py", line 638, in prepare
backend-1   |     return await self._prepare(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/asyncpg/connection.py", line 657, in _prepare
backend-1   |     stmt = await self._get_statement(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/asyncpg/connection.py", line 443, in _get_statement
backend-1   |     statement = await self._protocol.prepare(
backend-1   |                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "asyncpg/protocol/protocol.pyx", line 165, in prepare
backend-1   | asyncpg.exceptions.UndefinedFunctionError: operator does not exist: character varying = integer
backend-1   | HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
backend-1   | 
backend-1   | The above exception was the direct cause of the following exception:
backend-1   | 
backend-1   | Traceback (most recent call last):
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
backend-1   |     self.dialect.do_execute(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
backend-1   |     cursor.execute(statement, parameters)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
backend-1   |     self._adapt_connection.await_(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
backend-1   |     return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
backend-1   |     value = await result
backend-1   |             ^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
backend-1   |     self._handle_exception(error)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
backend-1   |     self._adapt_connection._handle_exception(error)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
backend-1   |     raise translated_error from error
backend-1   | sqlalchemy.dialects.postgresql.asyncpg.AsyncAdapt_asyncpg_dbapi.ProgrammingError: <class 'asyncpg.exceptions.UndefinedFunctionError'>: operator does not exist: character varying = integer
backend-1   | HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
backend-1   | 
backend-1   | The above exception was the direct cause of the following exception:
backend-1   | 
backend-1   | Traceback (most recent call last):
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/uvicorn/protocols/http/httptools_impl.py", line 409, in run_asgi
backend-1   |     result = await app(  # type: ignore[func-returns-value]
backend-1   |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__
backend-1   |     return await self.app(scope, receive, send)
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/applications.py", line 1135, in __call__
backend-1   |     await super().__call__(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/applications.py", line 107, in __call__
backend-1   |     await self.middleware_stack(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 186, in __call__
backend-1   |     raise exc
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/middleware/errors.py", line 164, in __call__
backend-1   |     await self.app(scope, receive, _send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 93, in __call__
backend-1   |     await self.simple_response(scope, receive, send, request_headers=headers)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/middleware/cors.py", line 144, in simple_response
backend-1   |     await self.app(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/middleware/exceptions.py", line 63, in __call__
backend-1   |     await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
backend-1   |     raise exc
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
backend-1   |     await app(scope, receive, sender)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/middleware/asyncexitstack.py", line 18, in __call__
backend-1   |     await self.app(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/routing.py", line 716, in __call__
backend-1   |     await self.middleware_stack(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/routing.py", line 736, in app
backend-1   |     await route.handle(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/routing.py", line 290, in handle
backend-1   |     await self.app(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 115, in app
backend-1   |     await wrap_app_handling_exceptions(app, request)(scope, receive, send)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 53, in wrapped_app
backend-1   |     raise exc
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/starlette/_exception_handler.py", line 42, in wrapped_app
backend-1   |     await app(scope, receive, sender)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 101, in app
backend-1   |     response = await f(request)
backend-1   |                ^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 355, in app
backend-1   |     raw_response = await run_endpoint_function(
backend-1   |                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/fastapi/routing.py", line 243, in run_endpoint_function
backend-1   |     return await dependant.call(**values)
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/api/home/routes.py", line 186, in update_country_route
backend-1   |     return await update_country(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/api/home/logics.py", line 404, in update_country
backend-1   |     await db.execute(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/ext/asyncio/session.py", line 449, in execute
backend-1   |     result = await greenlet_spawn(
backend-1   |              ^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 201, in greenlet_spawn
backend-1   |     result = context.throw(*sys.exc_info())
backend-1   |              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2351, in execute
backend-1   |     return self._execute_internal(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/orm/session.py", line 2249, in _execute_internal
backend-1   |     result: Result[Any] = compile_state_cls.orm_execute_statement(
backend-1   |                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/orm/context.py", line 306, in orm_execute_statement
backend-1   |     result = conn.execute(
backend-1   |              ^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1419, in execute
backend-1   |     return meth(
backend-1   |            ^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/sql/elements.py", line 527, in _execute_on_connection
backend-1   |     return connection._execute_clauseelement(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1641, in _execute_clauseelement
backend-1   |     ret = self._execute_context(
backend-1   |           ^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1846, in _execute_context
backend-1   |     return self._exec_single_context(
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1986, in _exec_single_context
backend-1   |     self._handle_dbapi_exception(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 2363, in _handle_dbapi_exception
backend-1   |     raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/base.py", line 1967, in _exec_single_context
backend-1   |     self.dialect.do_execute(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/engine/default.py", line 952, in do_execute
backend-1   |     cursor.execute(statement, parameters)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 585, in execute
backend-1   |     self._adapt_connection.await_(
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 132, in await_only
backend-1   |     return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
backend-1   |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/util/_concurrency_py3k.py", line 196, in greenlet_spawn
backend-1   |     value = await result
backend-1   |             ^^^^^^^^^^^^
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 563, in _prepare_and_execute
backend-1   |     self._handle_exception(error)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 513, in _handle_exception
backend-1   |     self._adapt_connection._handle_exception(error)
backend-1   |   File "/app/.venv/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 797, in _handle_exception
backend-1   |     raise translated_error from error
backend-1   | sqlalchemy.exc.ProgrammingError: (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedFunctionError'>: operator does not exist: character varying = integer
backend-1   | HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
backend-1   | [SQL: SELECT countries.id, countries.created_at, countries.updated_at, countries.name, countries.currency_code, countries.whatsapp, countries.email_support 
backend-1   | FROM countries 
backend-1   | WHERE countries.whatsapp = $1::INTEGER]
backend-1   | [parameters: (23456789,)]
backend-1   | (Bac
