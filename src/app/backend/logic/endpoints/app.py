from fastapi import APIRouter, HTTPException, status

import src.core.models as m
from src.core.exceptions import InternalError

app_router = APIRouter()


@app_router.post("/do_something", status_code=status.HTTP_200_OK)
async def do_something(
    data: m.DoSomething,
):  # For singletons do: adapter: Annotated[MyAdapter, Depends(lambda: my_adapter)]):
    try:
        success = True if data.foo == data.bar else False
    except InternalError:  # Handle errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    if not success:  # Handle misconduct
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Foo and bar went horribly wrong",
        )
