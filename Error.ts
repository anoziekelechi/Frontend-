 Traceback (most recent call last):
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
backend-1   |   File "/app/api/home/logics.py", line 408, in update_country
backend-1   |     if existing_whatsapp and existing_whatsapp.id != country_id:
backend-1   |        ^^^^^^^^^^^^^^^^^
backend-1   | UnboundLocalError: cannot access local variable 'existing_whatsapp' where it is not associated with a value
