
import { useState,useEffect ,useRef} from "react";
import { getDevices, getFiles, getstorage,deleteFile, uploadFile } from "./api.js"; // ye mere api se data fetch kiya hua bulaya
import DeviceCard from "./components/DeviceCard.jsx";
function App(){
  //this creates react component
  const [storage,setStorage]=useState(null)
  //storage will store curr storage value,setStorage fn to update data,initial value is null
  // when setStoarge wil get call eventually store setStorage(data)
  useEffect(()=>{
    async function loadStorage() {
      const data=await getstorage() //waits for fast api response
      setStorage(data) //updates the data
    }
    loadStorage()
  },[])

  const [devices,setDevices]=useState([])
  useEffect(()=>{
    async function loadDevice() {
      const d = await getDevices(); //calling the api to fetch data
      console.log("Devices API response:", d); //inspect f12 console
      console.log("Is it an array?", Array.isArray(d));//array hai toh yes/no  .... it will show no as d is obj
      setDevices(d.devices);// array ke isnde jaanee ke liye
    }
    loadDevice() //deviceStoarge apne aysnc fn kho call kar raha hai
  },[])

  const[files,setFiles]=useState([]) //file bring array of already files and setfile update one
  useEffect(()=>{
    async function loadFiles(){
      const d=await getFiles() //calls and comunicates with api tp fetch data
      setFiles(d.files) //again same as device kyuki ki file ke andar hai
    }
    loadFiles()
  },[])
  ///creatung ref ibj so that humesha file uplaod ke baad purana file hat jaaye
  const inputRef= useRef(null)
  //useEffect when the component mounts
  //laodstorage calls our async fn
  // also [] empty dependency array so effect doenst re runs bcoz of state change
  const [selectedFile,setSelectedFile]=useState(null) //user selected file and updates the file selected
  async function handleDelete(fileId){ //singular id se kar rahne hai isliye
    try {
      const result = await deleteFile(fileId) //it will wait for file to get deleted

      if (result.message !== "file is deleted") {
        throw new Error(result.detail || "Deletion failed")
      }

      setFiles((previousfile)=> //then it will display rest of the file
        previousfile.filter((file)=>file.id!==fileId)
      )
    } catch (error) {
      console.error("Delete error:", error)
      alert("Could not delete the file. Please try again.")
    }
  }
  const[isUplaoding,setIsUplaoding]=useState(false)
  async function handleUpload() {
    if(!selectedFile){
      alert("please enter a file first !")
      return
    }
    if(selectedFile.size>=(5*1024*1024)){
      alert("file size cannot be greater than or equal to 5MB")
      return
    }
    try{
        setIsUplaoding(true)
        const result=await uploadFile(selectedFile) //uplaoded file bhejo api.js kho rembeber we are posting
        if(result.message!=="file metadata recorded"){
          throw new Error(result.detail||"Uplaoding Failed")
        }
        const updateData= await getFiles() // array of files lao fetch karke
        setFiles(updateData.files)  // obj nahi uske andar ke array lao updates wale // new file ke saath old wale show karo
        setSelectedFile(null) //again selected file empty
        inputRef.current.value = "" // choose file vapas dhikho by clearing old file name ///file picker clear 
    }
    catch(error){
      console.error("Uplaod Error: ",error)
      alert(error.message)
    }
    finally{
      setIsUplaoding(false)
    }
  }
  return ( //this defines what will appear on the screen
    <main>
      {/* Main dashboard content */}
      <h1>🐡 PuffPress</h1>
      <p>Your files,Your Choice,Your Cloud</p><hr/>

      <h2>Storage Overview</h2>
      <p>Total Storage: {storage?.total_storage??"Loading"} GB</p>
      {/*?. means storage is null then dont access it ?? agar null ya undefined ho toh laoding..*/}
      <p>Used Storage: {storage?.used_storage??"Loading"} GB</p>
      <p>Free Space in Stoarge: {storage?.free_storage??"Loading"} GB</p>

      {/*.map() goes through an array and creates a new array by transforming each element.*/}
      <h3>Connected Devices</h3>
      {/* this devie-ocean is for arranging our bubbles*/}
      <div className="device-ocean">
        {devices.map((device)=>(
          //devices api se laaya hua data hum decvice card kho de raha hei and woh
          // props pass kar raha so that woh css apply karke show kare
          <DeviceCard
            key={device.id}
            name={device.name}
            status={device.status}
            total_gb={device.total_gb}
            used_gb={device.used_gb}
          />
        ))}
      </div>
        <input
        type="file"
        ref={inputRef}
        onChange={(event)=>{
          console.log("Selected file:", event.target.files[0])
          setSelectedFile(event.target.files[0])}}
        />
        <button onClick={()=>handleUpload()}
          disabled={isUplaoding}
          >
          {isUplaoding? "Uploading":"Upload" }
        </button>
      <h2>My Uploaded Files</h2>
      {
        files.length===0?<p>No files uploaded yet.</p>:
        files.map((file)=>{
          const url=`http://127.0.0.1:8000/files/${file.id}/download`
          return(
            <div key={file.id}>
              <p>{file.name} - {file.size} bytes</p>
              <a href={url}>Download</a>
              <button onClick={() => handleDelete(file.id)}>
                Delete
              </button>
            </div>
          )
      })}
    </main>
  )
}

export default App

//next step is our connecing react to fastapi(backend)
/* we are going t use fetch() for req data from api
useState - store the res in react
useEFfect  fetch data whem the component loads */
