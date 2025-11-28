from pydantic import BaseModel


class DoSomething(BaseModel):
    foo: str
    bar: str
