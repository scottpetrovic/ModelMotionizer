import { quat as Quaternion }  from 'gl-matrix'

/* Three.js doesn't have many Quaternion functions for calculations, so this is a collection of useful functions
   will fill in that void */
class QuatUtil
{

    /** Used to get data from a flat buffer */
    static fromBuf( out: Quaternion, ary : Array<number> | Float32Array, idx: number ) : Quaternion 
    {
        out[ 0 ]  = ary[ idx ];
        out[ 1 ]  = ary[ idx + 1 ];
        out[ 2 ]  = ary[ idx + 2 ];
        out[ 3 ]  = ary[ idx + 3 ];
        return out;
    }

    /** Put data into a flat buffer */
    static toBuf( q: Quaternion, ary : Array<number> | Float32Array, idx: number ) : QuatUtil 
    { 
        ary[ idx ]      = q[ 0 ];
        ary[ idx + 1 ]  = q[ 1 ];
        ary[ idx + 2 ]  = q[ 2 ];
        ary[ idx + 3 ]  = q[ 3 ];
        return this;
    }


    static lenSqr( a: Quaternion, b: Quaternion ): number
    {
        return  (a[ 0 ]-b[ 0 ]) ** 2 + 
                (a[ 1 ]-b[ 1 ]) ** 2 + 
                (a[ 2 ]-b[ 2 ]) ** 2 +
                (a[ 3 ]-b[ 3 ]) ** 2 ;
    }

    static isZero( q: Quaternion ): boolean 
    { 
        return ( q[0] == 0 && q[1] == 0 && q[2] == 0 && q[3] == 0 ); 
    }

    static negate( out: Quaternion, q?: Quaternion ): Quaternion
    {
        if( !q ) q = out;
        out[ 0 ] = -q[ 0 ];
        out[ 1 ] = -q[ 1 ];
        out[ 2 ] = -q[ 2 ];
        out[ 3 ] = -q[ 3 ];
        return out;
    }

    /** Checks if on opposite hemisphere, if so, negate change Quaternion */
    static dotNegate( out: Quaternion, chg: Quaternion, chk: Quaternion ): Quaternion
    { 
        if( Quaternion.dot( chg, chk ) < 0 ) this.negate( out, chg );
        return out;
    }

    /** PreMultiple an Axis Angle to this quaternions */
    static pmulAxisAngle( out: Quaternion, axis: Quaternion, angle: number, q: Quaternion ) : Quaternion
    {
        const half = angle * .5,
              s    = Math.sin( half ),
              ax   = axis[0] * s,	// A Quat based on Axis Angle
              ay   = axis[1] * s, 
              az   = axis[2] * s,
              aw   = Math.cos( half ),

              bx   = q[0],		// B of mul
              by   = q[1],
              bz   = q[2],
              bw   = q[3];
        // Quat.mul( a, b );
        out[ 0 ] = ax * bw + aw * bx + ay * bz - az * by;
        out[ 1 ] = ay * bw + aw * by + az * bx - ax * bz;
        out[ 2 ] = az * bw + aw * bz + ax * by - ay * bx;
        out[ 3 ] = aw * bw - ax * bx - ay * by - az * bz;
        return out;
    }

    /** Inverts the quaternion passed in, then pre multiplies to this quaternion. */
    static pmulInvert( out: Quaternion, q: Quaternion, qinv: Quaternion ): Quaternion
    {
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // q.invert()
        let ax = qinv[ 0 ],	
            ay = qinv[ 1 ],
            az = qinv[ 2 ],
            aw = qinv[ 3 ];

        const dot = ax*ax + ay*ay + az*az + aw*aw;

        if( dot == 0 ){
            ax = ay = az = aw = 0;
        }else{
            const dot_inv = 1.0 / dot;
            ax = -ax * dot_inv;
            ay = -ay * dot_inv;
            az = -az * dot_inv;
            aw =  aw * dot_inv;
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Quaternion.mul( a, b );
        const bx = q[ 0 ],	
              by = q[ 1 ],
              bz = q[ 2 ],
              bw = q[ 3 ];
        out[ 0 ] = ax * bw + aw * bx + ay * bz - az * by;
        out[ 1 ] = ay * bw + aw * by + az * bx - ax * bz;
        out[ 2 ] = az * bw + aw * bz + ax * by - ay * bx;
        out[ 3 ] = aw * bw - ax * bx - ay * by - az * bz;

        return out;
    }

    static nblend( out: Quaternion, a: Quaternion, b: Quaternion, t: number ) : Quaternion
    {
        // https://physicsforgames.blogspot.com/2010/02/quaternions.html
        const a_x = a[ 0 ],	// Quaternion From
            a_y = a[ 1 ],
            a_z = a[ 2 ],
            a_w = a[ 3 ],
            b_x = b[ 0 ],	// Quaternion To
            b_y = b[ 1 ],
            b_z = b[ 2 ],
            b_w = b[ +3 ],
            dot = a_x*b_x + a_y*b_y + a_z*b_z + a_w*b_w,
            ti 	= 1 - t;
        let s 	= 1;

        // if Rotations with a dot less then 0 causes artifacts when lerping,
        // Can fix this by switching the sign of the To Quaternion.
        if( dot < 0 ) s = -1;

        out[ 0 ]	= ti * a_x + t * b_x * s;
        out[ 1 ]	= ti * a_y + t * b_y * s;
        out[ 2 ]	= ti * a_z + t * b_z * s;
        out[ 3 ]	= ti * a_w + t * b_w * s;

        return Quaternion.normalize( out, out );
    }
}

export default QuatUtil;