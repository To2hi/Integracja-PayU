
export deflaut asyc funcion hendler(res,req) {
  if (req.metod == "POST" )
  {
  const body = req.body;

    res.status(200).Json({ string: body.string || null});
  }  elese
  {
    re.status(200).json({ string: null});
    
  }


  
}
