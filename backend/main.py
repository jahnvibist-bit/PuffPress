from fastapi import FastAPI,HTTPException,Response,Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile
from fastapi import File
from pathlib import Path #used for handling file & folder loc
from uuid import uuid4
import sqlite3,zlib,os
dbconn=sqlite3.connect("puffpress.db")#creates a new db or opens a exitising one
cursor=dbconn.cursor() #used for executing querries
cursor.execute("""CREATE TABLE IF NOT EXISTS files(
    id TEXT PRIMARY KEY,
    name TEXT,
    size INTEGER,
    path TEXT
);""")
app=FastAPI() 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET","POST","DELETE"],
    allow_headers=["*"],
)

#obj of that class
@app.get("/")
def home():
    return{
        "app":"PuffPress",
        "message":"Your Personal storage universe",
        "status":"Pending"
    }
@app.get("/about")
def about():
    return{
        "app":"PuffPress",
        "message":"see your data storage distirbution",
        "status":"pending.."
    }
#we are creating storage device
#list of simulated devices.
devices=[
    {
        "id":1,
        "name":"Puff Node A",
        "status":"online",
        "total_gb":50,
        "used_gb":20
    },
    {               
        "id":2,
        "name":"Puff Node B",
        "status":"online",
        "total_gb":100,
        "used_gb":45
    },
    {
        "id":3,
        "name":"Puff Node C",
        "status":"offline",
        "total_gb":80,
        "used_gb":30
    }
]

#these ar emy dummy value for ui development , no real mm of disk

#creating an endpoint that will return this devices
@app.get("/devices")
def device():
    return{
        "devices":[ keys for keys in devices]
    }

def calc_free_space(total_space,used_space):
    free_space=total_space-used_space
    return free_space

#saare device ka total bataya hai
@app.get("/storage")
def storage():
    total_space = sum(i["total_gb"] for i in devices)
    used_space = sum(i["used_gb"] for i in devices)
    return {
        "total_storage": total_space,
        "used_storage": used_space,
        "free_storage": calc_free_space(total_space, used_space)
    }
#file upload karne ke liye endpint bana rahe hai
@app.post("/upload")
#file var name and : uploadFile -> telling fastapi ki obj file hai = File(...)-> fastapi se file lo ye reuired hai 
async def upload_file(file:UploadFile=File(...)): 
    content=await file.read()
    if len(content)>=(5*1024*1024):
        raise HTTPException(status_code=413,detail="file too large")
    compressed_content=zlib.compress(content)
    print("Original size:", len(content))
    print("Compressed size:", len(compressed_content))
    storage_folder = Path("storage")
    #This creates a Path object, not an actual folder.
    storage_folder.mkdir(exist_ok=True)
    # Path("storage") → Write down the address of a storeroom.
    # .mkdir() → Actually build the storeroom.
    # exist_ok=True → If the storeroom already exists, don't throw an error.
    file_id=uuid4()
    file_path=storage_folder/f"{file_id}.bin"
    dbconn=sqlite3.connect("puffpress.db")#creates a new db or opens a exitising one
    cursor=dbconn.cursor()

    with open(file_path,"wb+") as f:
        f.write(compressed_content)
    file_info={
        "id":str(file_id),
        "name":file.filename,
        "size":len(compressed_content)
    }
    query="""INSERT INTO files(id,name,size,path)VALUES(?,?,?,?)"""
    values=(file_info["id"],file_info["name"],file_info["size"],str(file_path))
    cursor.execute(query,values)
    dbconn.commit()
    dbconn.close()
    return{
        "filename":file.filename,
        "size_byte":len(compressed_content),
        "message":"file metadata recorded",
    }
#to prevent duplicates we aregoing to use built in uuid to genearte unique id
@app.get("/files")
def get_files():
    dbconn=sqlite3.connect("puffpress.db")#creates a new db or opens a exitising one
    dbconn.row_factory = sqlite3.Row
    cursor=dbconn.cursor()
    files=cursor.execute("""Select * from files""").fetchall()
    dbconn.commit()
    dbconn.close()
    return{
        "files":files
    }
# cursor.execute() → You place the order.
# cursor.fetchall() → You collect all the dishes that were prepared.
#Even with row_factory, each result is still a
# sqlite3.Row object, not a normal Python dictionary.
@app.get("/files/{file_id}/download")
def download_file(file_id:str):
    dbconn=sqlite3.connect("puffpress.db")#creates a new db or opens a exitising one
    dbconn.row_factory = sqlite3.Row
    cursor=dbconn.cursor()
    file=cursor.execute("""Select * from files where id = ?""",(file_id,)).fetchone()
    dbconn.close()
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")
    file_path=file["path"]
    with open(file_path,"rb") as r:
        compressed_data=r.read()
        decompressed_data=zlib.decompress(compressed_data)
    original_name=file["name"]
    return Response(
        content=decompressed_data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition":f'attachment;filename={original_name}'
        }
        )
@app.delete("/files/{file_id}")
def deleteFile(file_id:str): #file id string haina
    dbconn=sqlite3.connect("puffpress.db")#creates a new db or opens a exitising one
    dbconn.row_factory = sqlite3.Row
    cursor=dbconn.cursor()
    cursor.execute(
        "SELECT * FROM files WHERE id=?",
        (file_id,))
    file = cursor.fetchone()
    if file is None:
        dbconn.close()
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.isfile(file["path"]): #checking if that file exists or not
        dbconn.close()
        raise HTTPException(
            status_code=404,
            detail="Stored file not found"
        )
    os.remove(file["path"]) #removes from main location
    cursor.execute("DELETE FROM files where id=?", (file_id,))
    dbconn.commit()
    dbconn.close()
    return{
        "message":"file is deleted"
    }



    
    
