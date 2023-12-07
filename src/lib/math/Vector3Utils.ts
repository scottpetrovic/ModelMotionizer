import type { vec3 as Vector3 }  from 'gl-matrix'

export type ThreeJSVector3 = { x: number, y: number, z: number }; // Handle Data form ThreeJS

class Vector3Utils{

    static len( a: Vector3, b: Vector3 ): number
    {
        return Math.sqrt( 
            (a[ 0 ]-b[ 0 ]) ** 2 + 
            (a[ 1 ]-b[ 1 ]) ** 2 + 
            (a[ 2 ]-b[ 2 ]) ** 2
        );
    }

    static lenSqr( a: Vector3, b: Vector3 ): number
    {
        return  (a[ 0 ]-b[ 0 ]) ** 2 + 
                (a[ 1 ]-b[ 1 ]) ** 2 + 
                (a[ 2 ]-b[ 2 ]) ** 2 ;
    }

    static isZero( v: Vector3 ): boolean 
    { 
        return ( v[0] == 0 && v[1] == 0 && v[2] == 0 ); 
    }

    /** When values are very small, like less then 0.000001, just make it zero */
    static nearZero( out: Vector3, v: Vector3 ) : Vector3
    {
        out[ 0 ] = ( Math.abs( v[ 0 ] ) <= 1e-6 )? 0 : v[ 0 ];
        out[ 1 ] = ( Math.abs( v[ 1 ] ) <= 1e-6 )? 0 : v[ 1 ];
        out[ 2 ] = ( Math.abs( v[ 2 ] ) <= 1e-6 )? 0 : v[ 2 ];
        return out;
    }
    
    //#region LOADING / CONVERSION
    /** Used to get data from a flat buffer */
    static fromBuf( out: Vector3, ary : Array<number> | Float32Array, idx: number ) : Vector3 
    {
        out[ 0 ]  = ary[ idx ];
        out[ 1 ]  = ary[ idx + 1 ];
        out[ 2 ]  = ary[ idx + 2 ];
        return out;
    }

    /** Put data into a flat buffer */
    static toBuf( v: Vector3, ary : Array<number> | Float32Array, idx: number ) : Vector3Utils 
    { 
        ary[ idx ]      = v[ 0 ];
        ary[ idx + 1 ]  = v[ 1 ];
        ary[ idx + 2 ]  = v[ 2 ];
        return this;
    }

    static toStruct( v: Vector3, o ?: ThreeJSVector3 ): ThreeJSVector3{
        o ??= { x:0, y:0, z:0 };
        o.x = v[ 0 ];
        o.y = v[ 1 ];
        o.z = v[ 2 ];
        return o;
    }

    static fromStruct( v: Vector3, o: ThreeJSVector3 ): Vector3{
        v[ 0 ] = o.x; 
        v[ 1 ] = o.y;
        v[ 2 ] = o.z;
        return v;
    }

    static toArray( v: Vector3 ): number[]
    { 
        return [ v[0], v[1], v[2] ];     
    }

}

export default Vector3Utils;